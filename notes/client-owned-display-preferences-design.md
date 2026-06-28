# Client-owned display preferences — design

Status: accepted (CHE-1301)
Effort: Client-owned display preferences (mobile + web)
Verification: [`notes/client-display-verify-harness.md`](client-display-verify-harness.md)

## Decision

A paired mobile or web client picks its own light/dark appearance instead of
inheriting the desktop host's resolved terminal palette. Each display setting is
classified by *where it takes effect* — host, client, or host-global — and only
the host- and host-global-authoritative settings stay shared. The render bucket
moves to the client. The host stops baking one resolved palette into the mobile
runtime graph and instead ships both the light and dark palettes; the client
selects locally.

This doc records decisions already made collaboratively. It exists for an
engineer who holds the *what* (a client should own its theme) and needs the
*why* — which alternatives were weighed, and which constraint each decision
protects — before touching the host's palette-transport path or the
shared-PTY arbitration.

## Context — what the host bakes today

The mobile runtime graph carries a single resolved terminal palette per session.
`resolveMobileTerminalTheme` in
[`src/renderer/src/runtime/sync-runtime-graph.ts`](../src/renderer/src/runtime/sync-runtime-graph.ts)
calls `resolveEffectiveTerminalAppearance(settings, systemPrefersDark)`, folds in
the host's `terminalColorOverrides`, opacity, and custom-theme inputs, and emits
one `RuntimeMobileTerminalTheme` — `{ mode, theme }` — into the graph. `mode` is
the host's resolved light-or-dark; `theme` is the host's resolved color map.

A paired client therefore renders the host operator's appearance choice, not its
own. Removing that baking — so the client receives the inputs it needs to choose
for itself — is the core of this effort.

## The three-bucket model

Every display setting is classified by *where it takes effect*. The bucket
decides whether the setting stays host-authoritative, moves to the client, or
remains a legitimately-shared global. Misclassifying a setting is the failure
this model exists to prevent: a render option left host-authoritative defeats the
whole effort, and a host/PTY setting pushed to the client desyncs the shared
shell.

| Bucket | Where it takes effect | Settings |
|---|---|---|
| **Host / PTY-authoritative** | One value per session — the PTY is a single shared shell | shell, scrollback, setup-script mode, and the CSI 997 color-scheme signal to background-adaptive TUIs |
| **Client render options** | Wherever pixels are drawn — each viewer chooses freely | theme/palette, fonts, cursor, GPU acceleration, scroll speed, focus-follows-mouse, copy-on-select, OSC-52 gate, opacity |
| **Host-global behavior** | Legitimately shared across all clients | default agents, task providers, worktree-card style |

Host/PTY-authoritative settings have exactly one correct value because the PTY is
one process: a second scrollback depth or a second shell for the same session is
incoherent. Client render options are pure xterm/CSS knobs applied at draw time,
so each viewer can pick independently with no effect on any other. Host-global
behavior is already synced through the `SettingsUpdate` allowlist and stays there
— it is shared by intent, not by accident of the old baking path.

## Decisions

### 1. Terminal palette transport — host resolves both palettes, client picks one

The host resolves **both** the light and dark palettes (running its full
theme-resolution and custom-theme machinery) and sends both in the runtime
graph. The client picks one locally based on its own appearance.

**Rejected — ship the resolution machinery to the client.** Sending the raw
theme config plus the custom-theme resolver to the client would let it resolve
either palette itself, but it duplicates the host's theme-resolution logic on
the client. The two copies would drift; a custom-theme feature added host-side
would silently not apply on mobile until the client copy caught up.

**Rejected — send only raw inputs.** Sending just the user's theme name and
override inputs is the smallest payload, but it forces the client to reimplement
resolution — the same duplication, pushed onto the wire instead of into a shared
library.

**Constraint protected:** theme resolution stays in exactly one place. The host
owns palette resolution; the client owns only the trivial light-vs-dark pick. A
custom-theme change lands host-side and reaches every client through the graph
with no client code change.

### 2. CSI 997 arbitration — the floor holder drives the single signal

Background-adaptive TUIs (vim, delta) read a CSI 997 color-scheme signal to
choose their own light/dark rendering. There is one such signal per session. The
terminal floor/driver holder's light/dark drives it, reusing the existing
`mobileTookFloor` / `isTerminalInputLockedForClient` concept in
[`src/main/runtime/orca-runtime.ts`](../src/main/runtime/orca-runtime.ts) and
[`src/main/runtime/rpc/methods/terminal.ts`](../src/main/runtime/rpc/methods/terminal.ts).
Whichever client holds the floor determines the one CSI 997 byte the shared shell
emits.

**Rejected — true per-client divergence.** Letting each client signal its own
color scheme to the TUI is impossible: the PTY is one shared shell broadcasting
one byte stream. There is one `HeadlessEmulator` and one `dataListeners`
fan-out — a single output sequence reaches every connected client. A TUI cannot
render dark for one viewer and light for another from one byte stream.

**Rejected — "client sends preference up, server resolves per-connection."**
Routing each client's preference to the server and resolving CSI 997 per
connection sounds like it sidesteps the constraint, but it does not: the
resolution still has to collapse to one byte on the one shared stream. Per-
connection resolution by itself doesn't escape the shared-PTY constraint — it
just moves the collapse point without removing it.

**Constraint protected:** one PTY, one output stream, one CSI 997 signal. The
floor concept already arbitrates *who controls the shared shell*; reusing it for
the color-scheme signal keeps a single, already-understood owner instead of
inventing a second arbitration scheme that would still have to collapse to one
byte.

### 3. Client-local-by-default — render preferences live on the client

Render-bucket preferences (Decision's "client render options") live on the
client, not host-persisted. The client stores them and applies them at draw
time; the host never learns a client's theme.

**Precedent, not invention.** The web client already keeps theme plus
terminal-render fields in `localStorage` under `orca.web.settings.v1` (see
[`src/renderer/src/web/web-preload-api.ts`](../src/renderer/src/web/web-preload-api.ts)),
round-tripping only two card-style fields back to the host. Mobile already keeps
`terminalTextScale`, autocomplete, and link-mode in `AsyncStorage` (see
[`mobile/src/storage/preferences.ts`](../mobile/src/storage/preferences.ts)).
This decision extends an established pattern to the rest of the render bucket; it
does not add a new persistence layer.

**Rejected for v1 — per-device server-persisted prefs store.** A store that
persists each device's render preferences host-side — paralleling
`DeviceRegistry` with a `clientPrefs.get` / `clientPrefs.set` allowlist — is the
documented path *if* cross-device pref sync is ever wanted (a new phone inherits
your theme). It is explicitly **out of v1**: it adds a host store, an allowlist,
and a sync protocol to solve a problem v1 does not have. Client-local storage is
sufficient because a device choosing its own appearance has no reason to consult
the host.

**Constraint protected:** the host carries no per-client display state. A
client's theme is its own concern, stored where it is applied. The
server-persisted store stays a named future option, gated behind an actual
cross-device-sync requirement rather than built speculatively.

## Scope

The **web** client already satisfies the goal for both chrome and terminal: its
theme is `localStorage`-driven and independent of the host's resolved appearance.
Web work in this effort is **verification-only** — confirm the web client already
picks its own light/dark, capture the evidence, and add no new code path. The
moving parts are host-side (Decisions 1 and 2) and mobile-side (Decision 3
applied to the remaining render fields).

The per-device server-persisted prefs store (Decision 3's rejected alternative)
is out of v1 entirely.

## Verification

Sibling tickets are validated with the client-display verify harness,
[`notes/client-display-verify-harness.md`](client-display-verify-harness.md):

- **Rung 1 (static + unit gates)** fully covers the host-side tickets — add unit
  tests for the pure logic each introduces (palette-pair resolution for
  Decision 1, CSI 997 floor arbitration for Decision 2), which then run inside
  `pnpm test`.
- **Rung 2 (iOS Simulator light/dark capture)** proves the mobile client renders
  its own appearance in both modes, independent of the host's.
- **Rung 3 (web light/dark capture)** is the verification-only path for the web
  scope above.
