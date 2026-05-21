# SSH Port Forwarding in the Unified Ports UI

## Background

The current ports UI has two different models:

- Workspace ports: `WorkspacePort` rows from `workspacePorts.scan`, grouped by worktree and shown in the status-bar Ports popover, worktree cards, and workspace search.
- SSH forwarding ports: `PortForwardEntry` and `DetectedPort` rows from SSH IPC state, scoped to an SSH target/connection and currently shown only by the right-sidebar `PortsPanel`.

Those models should not be merged by pretending every SSH listener belongs to a worktree. The workspace scanner can only attribute a port when it can match the process cwd to a known worktree. Raw SSH detection intentionally has weaker information: host, port, optional pid, optional process name.

## Goals

- Make manual SSH forwarding reachable from the new Ports status-bar popover.
- Show raw remote SSH listeners somewhere in the new ports surface when the active workspace is SSH-backed.
- Keep worktree cards accurate by showing only ports confidently attributed to that worktree.
- Avoid duplicating forwarding form and row behavior across status bar and right sidebar.
- Preserve the right-sidebar tab until the status-bar flow has feature parity.

## Non-goals

- Do not show every raw remote listener on every SSH worktree card.
- Do not require `workspacePorts.scan` to succeed before SSH manual forwarding is available.
- Do not change SSH forwarding persistence format until the UI has a concrete need for per-worktree metadata.

## Recommended UX

### Status-Bar Ports Popover

Make the status-bar Ports popover the primary management surface.

For local workspaces, keep the current sections:

- Workspace ports
- External ports

For SSH-backed active workspaces, extend the same popover with SSH sections:

- Workspace ports: existing attributed `WorkspacePort` groups, if available.
- SSH forwards: active `PortForwardEntry` rows for the active SSH connection.
- Remote listeners: unforwarded `DetectedPort` rows from `detectedPortsByConnection`.
- Add forward: visible in the popover header for SSH-backed active workspaces.

Suggested ordering:

1. Workspace ports
2. SSH forwards
3. Remote listeners
4. External ports

Reasoning:

- Workspace-attributed ports stay first because they are the most precise and match the current mental model.
- Forwards come before raw detected listeners because they are user-managed and immediately usable locally.
- Raw listeners are useful discovery data, but they are lower-confidence and should not dominate the surface.

The popover summary should distinguish counts instead of collapsing everything into one number:

```text
Ports
3 workspace · 2 forwards · 5 remote
```

The compact status-bar segment can keep showing the workspace count to avoid a noisy behavior change. Its tooltip should include SSH counts when present.

### Worktree Cards

Keep worktree cards strict:

- Show the existing Plug icon only for `WorkspacePort` entries attributed to that worktree.
- Do not show raw `DetectedPort` entries on cards.
- Do not show `PortForwardEntry` rows on cards until forwards carry a reliable worktree association.

Optional later enhancement:

- Add a compact "Manage SSH ports" row action for SSH-backed worktrees that opens the status-bar popover focused to SSH sections. This gives discoverability without implying the raw listeners belong to that worktree.

### Right-Sidebar Ports Tab

Keep the restored SSH-only right-sidebar Ports tab while the status-bar popover is missing parity.

After the status-bar popover supports add, edit, remove, open, copy, and forward-detected actions, either:

- remove the SSH-only right-sidebar Ports tab, or
- keep it as an expanded management view reachable from the status-bar popover.

The default should be removal once parity exists. Two management surfaces for the same SSH state will drift unless one is clearly secondary.

## Implementation Plan

### 1. Extract the SSH forwarding view model

Create `src/renderer/src/lib/ssh-port-forwarding-model.ts`.

Responsibilities:

- Resolve the active SSH connection from active worktree -> repo -> `connectionId`.
- Read `sshConnectionStates`, `portForwardsByConnection`, and `detectedPortsByConnection`.
- Normalize loopback hosts for deduping forwards against detected listeners.
- Return:
  - `activeConnectionId`
  - `isSshWorkspace`
  - `isConnected`
  - `forwards`
  - `unforwardedDetectedPorts`
  - `counts`

This keeps connection-scoped state out of `PortsStatusSegment` and avoids duplicating the logic already inside `SshPortsPanel`.

### 2. Extract shared SSH forwarding components

Move the SSH-specific rows and dialog out of `right-sidebar/PortsPanel.tsx` into concrete, domain-named files under `src/renderer/src/components/ports/`:

- `SshForwardedPortRow.tsx`
- `SshDetectedPortRow.tsx`
- `SshPortForwardDialog.tsx`
- `ssh-port-forward-actions.ts`

The existing right-sidebar panel and the status-bar popover should consume these shared pieces.

Keep comments around the non-obvious constraints:

- Use `127.0.0.1` for copied local forward addresses because the listener binds there.
- Capture `targetId` at dialog-open time so worktree switching does not redirect a forward.
- Deduplicate loopback hosts only for matching, not display.

### 3. Add SSH sections to `PortsStatusSegment`

Update `src/renderer/src/components/status-bar/PortsStatusSegment.tsx` to:

- derive the SSH forwarding model for the active workspace
- render `SSH forwards` when forwards exist or when the active workspace is SSH-backed
- render `Remote listeners` for unforwarded detected ports
- show an `Add` icon button in the header for SSH-backed connected workspaces
- reuse `SshPortForwardDialog`

Disconnected state should be inline and scoped:

```text
SSH ports unavailable. Reconnect this target to manage forwards.
```

Do not replace the workspace scanner unavailable message. The SSH machinery can still work when `workspacePorts.scan` is unavailable.

### 4. Keep worktree cards workspace-only

No card data-model change in the first pass.

The existing `getWorkspacePortsByWorktreeId(scan)` behavior remains correct because cards are worktree-scoped. This avoids the main failure mode from issue #2536: raw SSH listeners being hidden because attribution failed, while also avoiding the opposite failure mode of showing unattributed listeners everywhere.

### 5. Decide the right-sidebar fate after parity

Once status-bar parity is complete, remove the SSH-only right-sidebar tab in a follow-up PR unless there is a clear product reason to keep a larger management panel.

If kept, make it a secondary route:

- status-bar popover: common management
- right-sidebar panel: expanded management

## Tests

Unit tests:

- SSH model dedupes forwarded and detected loopback endpoints.
- SSH model returns disconnected state without hiding existing persisted forwards.
- Status-bar popover renders SSH sections when active repo has `connectionId`.
- Status-bar popover still renders workspace-only content for local repos.
- Worktree card ports still depend only on attributed `WorkspacePort` rows.

Integration/UI checks:

- SSH-backed active workspace with `workspacePorts.scan` returning zero still shows `SSH forwards`, `Remote listeners`, and `Add`.
- Clicking detected remote listener `Forward` opens the dialog with remote port, normalized host, label, and captured target id.
- Existing forward can be opened, copied, edited, and removed from status-bar popover.
- Disconnected SSH target shows management disabled but does not make local workspace port UI regress.

## Open Questions

- Should the compact status-bar count remain workspace-only, or should it include forwards once SSH sections are present?
- Should forwards eventually persist an optional `worktreeId` for card-level display?
- Should `ports.detect` expose more process cwd data so remote listeners can sometimes be upgraded into attributed workspace ports without relying on `workspacePorts.scan`?
