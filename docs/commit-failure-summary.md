# Commit Failure Summary

## Problem

In Source Control, commit failures are stored per worktree in `commitErrors` (`Record<string, string | null>`) and rendered inline by `CommitArea` as raw text (`src/renderer/src/components/right-sidebar/SourceControl.tsx`, `handleCommit` and `commit-area-error`).

`git.commit` failures can include full hook/lint output (multi-line, ANSI-colored, very long). Rendering raw output inline expands the sidebar and pushes core controls out of view.

## Goal

Show a short inline failure summary while keeping the full raw error available in a modal dialog.

## Non-goals

- No IPC/runtime/provider contract changes (`git.commit` stays `{ success, error? }`).
- No exhaustive parser for every hook/linter format.
- No changes to remote-action errors or AI commit-generation errors.

## Constraints from current code

- `handleCommit` already stores raw commit error per worktree and clears it at commit start/success.
- `CommitArea` currently renders `commitError` verbatim in `#commit-area-error` with `role="alert"` and `aria-live="polite"`.
- `commitError`, `remoteActionError`, and `generateError` are independent and all can be referenced by textarea `aria-describedby`.
- Worktree-local state is intentionally preserved across worktree switches; stale keys are pruned when worktrees disappear.

## Design

1. Add `src/renderer/src/components/right-sidebar/commit-failure-summary.ts`:
   - `summarizeCommitFailure(raw: string): string`
   - `hasExpandedCommitFailureDetails(raw: string, summary: string): boolean`

2. Keep parser scope strict and deterministic:
   - Strip ANSI/control sequences and trim whitespace.
   - Split to non-empty lines and ignore low-signal noise (for example npm env-replacement warnings) only when stronger failure lines exist.
   - Detect common commit-hook/lint failures (`pre-commit`, `husky`, `lint-staged`, `eslint`, `oxlint`, generic `lint`/`Found N errors`).
   - Return `Lint failed during commit.` for clear lint/hook lint failures.
   - Return `Pre-commit hook failed.` for hook failures without a clearer lint signal.
   - Otherwise return the first meaningful line.
   - Empty input fallback: `Commit failed.`

3. Render behavior in `CommitArea`:
   - Replace inline raw error block with compact alert row using `TriangleAlert`, summary text, and optional `Details` button.
   - Preserve `id="commit-area-error"`, `role="alert"`, `aria-live="polite"` for accessibility continuity.
   - Keep summary single-line/truncated to avoid sidebar growth.

4. Details dialog:
   - Use existing `Dialog` primitive from `src/renderer/src/components/ui/dialog.tsx`.
   - Title: `Commit Failed`.
   - Description: summary.
   - Body: scrollable `<pre>` with raw error (`whitespace-pre-wrap`, mono styling, bounded height).
   - Footer close button via existing `DialogFooter`/`DialogClose` patterns.
   - Dialog open state is local to `CommitArea` and auto-resets closed when the active worktree changes or `commitError` changes/clears.
   - Reset key should include both worktree identity and error identity (for example `${worktreeId}:${commitError}`), not only error text.

5. Derivation and state rules:
   - Do not add new persisted error state in `SourceControl`; derive summary/details from current `commitError` only.
   - Compute summary with `useMemo` keyed by `commitError` for stable render behavior.
   - Keep raw error as source of truth; summary/details-visibility are derived every render.
   - If hooks are introduced inside `CommitArea` (dialog open state, memoized summary), update tests to render through React (`<CommitArea {...props} />`) instead of direct function invocation (`CommitArea(props)`), because direct invocation cannot run hookful components.

## Edge cases

- ANSI escape sequences in hook output.
- Errors emitted on either stderr or stdout (already possible in `commitChanges`).
- One-line failures: no `Details` button when normalized raw text is effectively the same as summary.
- Very large error payloads: inline remains bounded; full text stays dialog-only.
- Worktree switch while dialog open: details must reflect active worktree error; close dialog when error identity changes.
- Concurrent commit attempts:
  - same worktree is already guarded (`commitInFlightRef`).
  - different windows/processes can still mutate repo externally; UI must treat summaries as best-effort snapshots and refresh on next commit/status cycle.

## Feasibility

- All work is renderer-only and compatible with current API boundaries.
- String normalization/parsing is cheap relative to render cost; no runtime or IPC latency impact.
- Existing dialog/button primitives cover required UX; no new UI infrastructure needed.

## Tests

1. New unit tests for formatter module:
   - lint-staged/husky/oxlint sample collapses to `Lint failed during commit.`
   - pre-commit non-lint sample collapses to `Pre-commit hook failed.`
   - generic non-hook error falls back to first meaningful line.
   - ANSI stripping and empty-input fallback.
   - details visibility predicate correctness.

2. Update `CommitArea` tests:
   - inline shows summary, not raw multiline payload.
   - details trigger appears only when expanded details exist.
   - `commit-area-error` a11y attributes remain present.
   - dialog closes when `commitError` clears/changes.
   - tests render `CommitArea` as a React component (not direct function call) once hooks are added.

3. Keep existing generate/remote error behavior unchanged (regression check).

## Rollout

1. Add formatter + tests.
2. Integrate summary row + details dialog in `CommitArea`.
3. Update commit-area tests.
4. Run focused tests (`CommitArea*`, formatter tests), then `pnpm typecheck` and `pnpm lint`.
