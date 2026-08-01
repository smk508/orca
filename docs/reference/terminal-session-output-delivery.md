# Terminal Session Output Delivery

## Scope

This document covers how PTY output travels from the daemon that owns a session
to the clients that display it. It argues that the current push-to-a-bound-client
model is the wrong shape for the daemon's purpose, and proposes a cursor-based
model to replace it.

It does not cover input delivery, flow control watermarks, or the renderer-side
write pipeline, except where they share the same failure.

## The invariant this component exists to hold

**A session outlives the clients that watch it.** That is the daemon's entire
justification. A terminal survives a window close, an app restart, an update, a
network blip, and a laptop lid; clients come and go around it.

Every design decision below follows from taking that invariant literally.

## Why the current model contradicts it

Output delivery binds a session to one client. `createOrAttach` writes
`streamClientIdBySessionId[sessionId] = clientId`, the PTY's `onData` closure
captures that same `clientId`, and each chunk is enqueued to it.

That is a long-lived resource holding a direct reference to a short-lived one.
Two inversions follow.

### Production depends on consumption

The PTY reader's job is to move bytes out of the kernel. In the current model it
cannot do that without a live consumer: `onData` calls `enqueue(clientId, …)`,
and the batcher's first act is to look up that client and return if it is gone.
Whether anyone is watching decides whether the read is useful.

### Delivery is the only copy

When the batcher returns at its dead-client guard, the bytes cease to exist.
Nothing retained them, so there is nothing to resume from. This is why the
failure mode is permanent rather than a gap.

Persistence has the same inversion by a different route. History is not written
from the display stream — it travels a separate pull path. The daemon accumulates
`pendingOutputRecords` per session, and the app-side `DaemonPtyAdapter` drains
them on a timer via the `takePendingOutput` RPC and appends them to `output.log`
through its `HistoryManager`.

That drain is **destructive and single-consumer**. Records are cleared on take,
so nothing can re-read them, and only one client can ever be the reader. When the
reader stops draining, `session.ts` fills to `PENDING_OUTPUT_MAX_BYTES` (2 MB),
discards the buffer, latches `pendingOutputOverflowed`, and drops every
subsequent record until somebody takes again.

So there are two independent silent-drop paths, each keyed to a client that went
away: the stream route strands display, and the undrained pending buffer strands
persistence. In the incident both were dead at once for the same reason, which is
why a session's `output.log` froze at the same moment its pane did.

The daemon is closer to owning the record than this suggests: it already runs a
full terminal emulator per session, with scrollback and a sequenced pending
buffer carrying an overflow flag. The data is there. What is missing is that
consumption destroys it and admits only one consumer.

### What this cost in practice

On a headless runtime, six agent sessions accepted input and responded normally
while every byte of their output was discarded. A syscall trace showed the full
round trip working — the daemon wrote the keystroke to the PTY master, the agent
responded within a millisecond, the daemon read the response — and the bytes then
went nowhere. `status: running`, `connected: true`, `writable: true`,
`orphaned: false` throughout, and no log line at any point.

Sessions failed in batches, several within the same minute, because one
transport closing orphaned every session bound to it. Restarting the desktop
client could not help: the stale route lived in the daemon, which survives by
design.

## Target model

Push the model that the runtime's read API already exposes —
`oldestCursor` / `nextCursor` / `latestCursor` / `truncated` / `limited` — down
into delivery. That API is the right shape; it is merely sitting on top of a
push pipeline with a single hard-coded destination and no retention.

**The session owns a bounded, durable output buffer.** The PTY reader appends to
it unconditionally. This write does not depend on any consumer and cannot fail
for lack of one.

**Clients are consumers with cursors, not destinations.** Attaching means "stream
me from offset N". Disconnecting means a consumer stopped reading; nothing about
the session changes. A stale route becomes unrepresentable rather than merely
cleaned up.

**Subscriptions are owned by the client's lifetime.** The shorter-lived party
owns the binding, so teardown is automatic. A binding cannot outlive its owner.

**Discarding is an event, not silence.** When the buffer must drop under
pressure, it records a gap with a cursor range. A consumer that reads across a
gap knows to resync from a snapshot instead of silently believing it is current.
Orca already has this concept — the `droppedOutput` sentinel — but applies it
app-side, where it cannot describe bytes that never arrived.

## What the model subsumes

Several problems currently treated as separate collapse into this one:

- **Blank pane on reattach.** A pane that reads at a cursor gets the last N lines
  for free. No separate seeding path, and no scrollback stranded on disk while
  the pane renders empty.
- **Correlated failures.** One disconnect cannot darken six sessions, because a
  disconnect no longer touches session state.
- **Undetectable health.** Liveness becomes derivable from the quantity that
  matters: the distance between a session's write cursor and its consumers' read
  cursors. "Producing output nobody has read" becomes a queryable condition
  instead of an invisible one.
- **Legacy-daemon sessions.** Recovery today means respawn-and-rebind, which is
  impossible for a daemon whose binary an update replaced, so those sessions get
  the silent-drop path deliberately. Cursor-based reattach needs no respawn: the
  buffer is still there and a new consumer reads it.

That last point is the strongest argument for the abstraction. It resolves a
constraint that the current model has to special-case.

## Migration

The steps are independently shippable and each is useful alone.

1. **Make the current model truthful.** Clear routes when a client departs,
   resolve routes at delivery time rather than capturing a client id, and log
   sessions whose output has nowhere to go. This does not retain bytes; it stops
   the loss being permanent and silent.
2. **Make the pending buffer non-destructive and cursor-addressed.** Replace the
   drain-on-take semantics with a bounded ring carrying monotonic offsets, and
   let readers advance a cursor instead of emptying it. This is the load-bearing
   step: it admits more than one consumer, makes a read resumable, and removes
   the overflow-on-undrained failure — a consumer that goes away stops reading
   rather than causing a discard.
3. **Serve reattach from the buffer.** Replace snapshot seeding with a cursor
   read, which removes the separate restore path.
4. **Convert clients to cursor consumers.** Delivery becomes a projection over
   the buffer; the route map disappears.

Step 1 is a bug fix and belongs on its own. Steps 2 to 4 are the model change,
and are worth doing in order because each narrows what the next has to carry.

## Rules for new code

- Do not bind session-scoped state to a connection id. If something must be
  reachable per client, key it by the client and let the client's teardown
  remove it.
- Do not let reading data destroy it. A consumer should advance a cursor, not
  empty a buffer, so a second consumer and a resumed read both stay possible.
- Do not let a consumer's absence cause a discard. A reader that stops reading
  should fall behind, not force the producer to drop.
- Do not discard terminal output without recording that a discard happened, with
  enough information for a consumer to resync.
- Prefer a queryable condition over a boolean health flag. `connected`,
  `writable` and `orphaned` were all true for three days on sessions that were
  delivering nothing.
