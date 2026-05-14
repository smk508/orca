# Terminal Agent Glyph Corruption

## Problem

Issue #1847 reports garbled glyphs in macOS terminal panes (Claude Code, Codex).

Verified current behavior:

- New panes default to `terminalGpuAcceleration: 'auto'`.
- WebGL attaches only when all are true: GPU rendering enabled, mode allows it, not deferred, no prior pane context-loss lockout, and no prior complex-script marker for that pane.
- Live PTY output and replay output both run `terminalOutputRequiresDomRenderer(data)` before `xterm.write`.
- Gemini-like terminal titles force pane-level DOM rendering (`setPaneGpuRendering(false)`) regardless of global GPU mode.
- Global WebGL attach failure fallback (`suggestedRendererType = 'dom'`) is renderer-process-local (window-local), not app-global.

## Root Cause (Confidence: Medium)

Primary suspect is xterm WebGL rendering under high-churn agent output (box drawing, braille, private-use/powerline, emoji/ZWJ/VS), not PTY byte transport.

But this is not the only plausible path. There is a second known corruption class in this codebase: Unicode-width ordering during restore/reattach (`openTerminal` forces `unicode.activeVersion = '11'` before writes specifically to prevent `?`-style broken glyph layout). Do not present WebGL fallback as a complete fix for all garbling.

This is still a hypothesis. Do not assert PTY/daemon transport is impossible as a contributor.

## Critical Corrections

1. The current predicate is narrower than the incident surface.
- `terminalOutputRequiresDomRenderer` only targets RTL/complex-script shaping ranges.
- It does not currently cover box/braille/powerline/emoji-heavy streams that are common in agent TUIs.

2. The current regex contains a correctness bug.
- In `terminal-complex-script.ts`, this fragment is not a Unicode range match:
  `|\u{10EC0}-\u{10EFF}|\u{1E900}-\u{1E95F}`.
- Outside a character class, that expression is treated as literal sequence with `-`, so those intended ranges are effectively not detected.

3. “Global fallback” language must stay precise.
- Attach-failure fallback state is per renderer process (`suggestedRendererType` module state), so two windows can diverge.
- The complex-script/risk marker is also pane-local runtime state, so two windows attached to the same underlying PTY can make different renderer decisions until each window observes risky output.

4. Complex-script marker scope is per pane instance.
- `hasComplexScriptOutput` is runtime pane state, not persisted across pane recreation/remount.

## Required Design Changes

1. Replace the predicate with a renderer-risk predicate.
- Keep existing RTL/complex-script coverage.
- Add coverage for glyph classes seen in #1847-like failures: box drawing, block elements, braille, geometric symbols used by TUIs, private-use (powerline separators), emoji planes, ZWJ, variation selectors, replacement character.
- Implement ranges correctly (character classes or explicit code-point checks), no pseudo-ranges outside `[]`.

2. Keep detection on both live and replay paths.
- Existing ordering is correct and must remain: replay pre-flush -> risk mark -> guarded write.
- Marking is idempotent and safe to call repeatedly.
- Do not move detection behind visibility throttling; hidden-tab output must still mark risk state.

3. Preserve current mode semantics.
- `auto`: mark -> dispose WebGL -> stay DOM for that pane.
- `on`: mark only; no forced dispose from risk marker.
- `off`: unchanged.
- Gemini-title forced DOM remains an explicit separate override.

4. Keep settings transition behavior explicit.
- `setTerminalGpuAcceleration` already resets attach-failure suggestion on mode change.
- Do not claim cross-window reset; each renderer window owns its own suggestion state.

## Edge Cases To Handle Explicitly

- Chunk boundaries: surrogate pairs/ZWJ sequences can split across PTY chunks; detection can be delayed by one chunk.
- ANSI interleaving: matching should ignore escape bytes and still detect risky printable code points.
- False positives: private-use is broad; over-fallback to DOM is acceptable for correctness.
- Multi-window divergence: one window can be DOM-suggested while another still attempts WebGL.
- Same-session divergence: two panes/windows streaming the same PTY can diverge until each receives a risky chunk locally.
- Reattach/replay races: marker must run before every replay write path (including reconnect and tab restore).
- Pane lifecycle resets: pane recreation clears pane-local marker; this is expected and should be documented.
- Unicode width ordering is orthogonal: even with DOM fallback, corruption can persist if any restore path writes before Unicode 11 activation.

## Test Requirements

- Predicate positives: braille spinner, box drawing, block elements, powerline/private-use, emoji with and without ZWJ/VS, replacement char.
- Predicate negatives: plain ASCII and normal ANSI-only control output.
- Regex regression: explicit test proving intended supplementary-plane ranges are actually detected.
- Chunk-split regression: split a risky grapheme/sequence across two writes and verify eventual fallback.
- Rendering behavior:
  - `auto` falls back to DOM after mark.
  - `on` can still attach WebGL after mark.
- Replay parity: replay path triggers same fallback behavior as live path.
- Unicode guardrail: keep/extend test coverage that `openTerminal` sets Unicode 11 before caller-driven writes; this prevents a separate garbling class not solved by renderer fallback.

## Rollout

1. Replace `terminalOutputRequiresDomRenderer` with a correctly implemented renderer-risk predicate and update its focused unit tests.
2. Update `pty-connection.ts` imports/call sites so live and replay PTY output use the new predicate before writing.
3. Extend WebGL/rendering-control tests for `auto`, `on`, and replay parity.
4. Keep Unicode-ordering tests intact while changing fallback logic so we do not regress the non-WebGL corruption guardrail.
5. Run focused tests, then `pnpm typecheck` and `pnpm lint`.
6. Validate in Electron with Claude/Codex-style output, tab restore/replay, and GPU `auto|on|off` modes.

## Non-Goals

- No PTY encoding/protocol changes.
- No SSH-specific renderer branching.
- No removal of `on|auto|off` GPU setting modes.
- No CLI-specific special-casing; policy applies to terminal output characteristics.
