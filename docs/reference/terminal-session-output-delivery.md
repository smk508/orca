# Terminal Session Output Delivery

## Scope

How PTY output reaches the clients that display it, which layer owns a session's
authoritative state, and the one invariant that layer must hold.

This document was originally written to argue for replacing the delivery model.
Verifying its claims against the code falsified most of them — the model is
sound, and the defect was narrower than it looked. What follows is what survived
verification, kept because the invariant is easy to break again and the incident
that exposed it was expensive to diagnose.

## The invariant

**A session outlives the clients that watch it.** That is the daemon's entire
justification, and every rule below follows from taking it literally.

## What the design already gets right

Three properties were verified in the code and are worth knowing before changing
anything here, because each removes a failure that looks plausible from outside:

**The emulator is the authoritative copy, and it is unconditional.**
`Session.emitSubprocessOutput` writes every byte to the terminal emulator before
recording anything for delivery or persistence:

```ts
this.emulator.write(data)
this.recordPendingOutput({ kind: 'output', data })
```

Delivery is never the only copy. A session's full screen and scrollback remain
reconstructable from the daemon regardless of what any client did.

**A session already broadcasts to many clients.** `Session.attachedClients` is a
list, and output fans out to all of it. Multi-consumer delivery is not missing at
the session layer.

**The bounded pending buffer is safe, not lossy.** History travels a separate
pull path: the daemon accumulates `pendingOutputRecords`, and the app-side
`DaemonPtyAdapter` drains them on a timer via `takePendingOutput`. When nobody
drains, the buffer fills to `PENDING_OUTPUT_MAX_BYTES` (2 MB) and latches
`pendingOutputOverflowed`, after which records are discarded. That looks like data
loss and is not: the emulator kept ingesting throughout, the consumer sees
`overflowed` on its next take, and it re-anchors from a full snapshot. Bounded
memory with a snapshot fallback is the intended design.

## The defect this document exists for

One binding contradicted the invariant. `DaemonServer` routes a session's output
to a single client through `streamClientIdBySessionId`, which was written only by
`createOrAttach` and erased only on session **exit**. A client whose transport
closed left its sessions pointing at a `clientId` that no longer resolved, and
`DaemonStreamDataBatcher.enqueue` discarded every subsequent chunk at its
dead-client guard — with no error and no log line, until the session exited.

Note where this sits. The session layer is multi-consumer and the emulator holds
the state; the single stale-able binding is one layer above, in server-side
routing. That is why the failure was so hard to see from outside: every property
a health check looks at was genuinely healthy.

### What it cost

Six agent sessions on a headless runtime, dark for up to three days. Typing into
one of them showed the whole round trip working — the daemon wrote the keystroke
to the PTY master, the agent responded within a millisecond, the daemon read the
response — and the bytes then reached nobody. Throughout: `status: running`,
`connected: true`, `writable: true`, `orphaned: false`, and silence in the log.

Sessions failed in batches, several within the same minute, because one closing
transport orphaned every session bound to it.

The routing half is fixed: routes are cleared when a client departs, resolved at
delivery time rather than captured in the PTY's `onData` closure, and a session
with nowhere to send output logs `session-stream-unrouted`.

## The open gap

**Nothing re-attaches a session whose client went away.** Clearing the stale route
makes the daemon's state truthful and audible, but a session with no consumer
stays that way until something calls `createOrAttach` for it again. In the
incident the runtime never did, because nothing told it to — which is why those
sessions stayed dark across client restarts rather than recovering on their own.

Closing it needs an answer to "who notices, and who re-attaches": either the
daemon advertising unrouted sessions to a connecting client, or the app-side
reconciling its known sessions against the daemon after any reconnect. The
`session-stream-unrouted` log line is the detection primitive; the reconciliation
is not built.

## Rules for new code

- Do not bind session-scoped state to a connection id. If something must be
  reachable per client, key it by the client and let the client's teardown remove
  it. This is the rule the defect broke.
- Resolve a route at the moment you deliver, not when you register a handler. A
  captured id cannot notice that its owner is gone.
- Do not discard terminal output without recording that a discard happened. Both
  the stale-route drop and the pending-buffer overflow are legitimate discards;
  only one of them said so, and that is the one that took three days to find.
- Prefer a queryable condition over a boolean health flag. `connected`,
  `writable` and `orphaned` were all true for three days on sessions delivering
  nothing.
