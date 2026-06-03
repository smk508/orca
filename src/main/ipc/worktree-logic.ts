import { realpathSync } from 'fs'
import { posix, win32 } from 'path'
import type { GitWorktreeInfo, Worktree, WorktreeMeta } from '../../shared/types'
import { splitWorktreeId } from '../../shared/worktree-id'
import { DEFAULT_WORKSPACE_STATUS_ID } from '../../shared/workspace-statuses'
export {
  computeRemoteWorktreePath,
  computeWorkspaceRoot,
  computeWorktreePath,
  computeWorktreePathForLayout,
  ensurePathWithinWorkspace,
  getWorktreeCreationLayout,
  getWorktreePathSettings,
  hasRepoWorktreeBasePath,
  resolveEffectiveWorktreeLayout,
  resolveRemoteWorktreeLayout
} from './worktree-path-layout'
export type { EffectiveWorktreeLayout, RemoteWorktreeLayout } from './worktree-path-layout'

/**
 * Sanitize a worktree name for use in branch names and directory paths.
 * Strips unsafe characters and collapses runs of special chars to a single hyphen.
 */
export function sanitizeWorktreeName(input: string): string {
  // Why: keep Unicode letters/numbers (CJK, accented Latin, etc.) so users can
  // name workspaces in their own language. Git ref-format permits non-ASCII
  // bytes, and modern filesystems handle UTF-8 paths. Only strip characters
  // git or the filesystem actually rejects.
  const sanitized = input
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    // Why: git check-ref-format rejects any ref containing `..`, so a prompt
    // like "../../foo" that survives slugification as `..-..-foo` would
    // produce a branch name git refuses to create. Collapse runs of dots
    // to a single dot before the leading/trailing trim so internal `..`
    // sequences can't reach git.
    .replace(/\.{2,}/g, '.')
    .replace(/^[.-]+|[.-]+$/g, '')

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw new Error('Invalid worktree name')
  }

  return sanitized
}

export function sanitizeWorktreeDisplayName(input: string): string | undefined {
  const withoutControls = Array.from(input, (char) => {
    const code = char.charCodeAt(0)
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f) ? ' ' : char
  }).join('')
  const sanitized = withoutControls
    // Why: titles come from external systems. Strip bidi override controls so a
    // malicious title cannot visually reorder adjacent sidebar text.
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .trim()

  return sanitized || undefined
}

/**
 * Compute the full branch name by applying the configured prefix strategy.
 */
export function computeBranchName(
  sanitizedName: string,
  settings: { branchPrefix: string; branchPrefixCustom?: string },
  gitUsername: string | null
): string {
  if (settings.branchPrefix === 'git-username') {
    if (gitUsername) {
      return `${gitUsername}/${sanitizedName}`
    }
  } else if (settings.branchPrefix === 'custom' && settings.branchPrefixCustom) {
    return `${settings.branchPrefixCustom}/${sanitizedName}`
  }
  return sanitizedName
}

export function areWorktreePathsEqual(
  leftPath: string,
  rightPath: string,
  platform = process.platform
): boolean {
  if (platform === 'win32' || looksLikeWindowsPath(leftPath) || looksLikeWindowsPath(rightPath)) {
    const left = win32.normalize(win32.resolve(leftPath))
    const right = win32.normalize(win32.resolve(rightPath))
    // Why: `git worktree list` can report the same Windows path with different
    // slash styles or drive-letter casing than the path we computed before
    // creation. Orca must treat those as the same worktree or a successful
    // create spuriously fails until the next full reload repopulates state.
    return left.toLowerCase() === right.toLowerCase()
  }
  const left = normalizePosixWorktreePathForComparison(leftPath, platform)
  const right = normalizePosixWorktreePathForComparison(rightPath, platform)
  return left === right
}

function looksLikeWindowsPath(pathValue: string): boolean {
  return (
    /^[A-Za-z]:[\\/]/.test(pathValue) || pathValue.startsWith('\\\\') || pathValue.startsWith('//')
  )
}

function normalizePosixWorktreePathForComparison(
  pathValue: string,
  platform: NodeJS.Platform
): string {
  const normalized = posix.normalize(posix.resolve(realpathExistingPosixPath(pathValue)))
  if (platform !== 'darwin') {
    return normalized
  }
  if (normalized === '/private/tmp') {
    return '/tmp'
  }
  return normalized.startsWith('/private/tmp/') ? normalized.slice('/private'.length) : normalized
}

function realpathExistingPosixPath(pathValue: string): string {
  try {
    // Why: git worktree list reports canonical paths on symlinked filesystems.
    // Match the path Git returns after creation without rejecting missing paths.
    return realpathSync(pathValue)
  } catch {
    return pathValue
  }
}

/**
 * Determine whether a display name should be persisted.
 * A display name is set only when the user's requested name differs from
 * both the branch name and the sanitized name (i.e. it was modified).
 */
export function shouldSetDisplayName(
  requestedName: string,
  branchName: string,
  sanitizedName: string
): boolean {
  return !(branchName === requestedName && sanitizedName === requestedName)
}

/**
 * Merge raw git worktree info with persisted user metadata into a full Worktree.
 */
export function mergeWorktree(
  repoId: string,
  git: GitWorktreeInfo,
  meta: WorktreeMeta | undefined,
  defaultDisplayName?: string
): Worktree {
  const branchShort = git.branch.replace(/^refs\/heads\//, '')
  const pathOps = looksLikeWindowsPath(git.path) ? win32 : posix
  return {
    id: `${repoId}::${git.path}`,
    ...(meta?.instanceId !== undefined ? { instanceId: meta.instanceId } : {}),
    repoId,
    path: git.path,
    head: git.head,
    branch: git.branch,
    isBare: git.isBare,
    ...(git.isSparse === true ? { isSparse: true } : {}),
    isMainWorktree: git.isMainWorktree,
    displayName:
      meta?.displayName || branchShort || defaultDisplayName || pathOps.basename(git.path),
    comment: meta?.comment || '',
    linkedIssue: meta?.linkedIssue ?? null,
    linkedPR: meta?.linkedPR ?? null,
    linkedLinearIssue: meta?.linkedLinearIssue ?? null,
    linkedGitLabMR: meta?.linkedGitLabMR ?? null,
    linkedGitLabIssue: meta?.linkedGitLabIssue ?? null,
    isArchived: meta?.isArchived ?? false,
    isUnread: meta?.isUnread ?? false,
    isPinned: meta?.isPinned ?? false,
    sortOrder: meta?.sortOrder ?? 0,
    ...(meta?.manualOrder !== undefined ? { manualOrder: meta.manualOrder } : {}),
    lastActivityAt: meta?.lastActivityAt ?? 0,
    ...(meta?.createdAt !== undefined ? { createdAt: meta.createdAt } : {}),
    ...(meta?.createdWithAgent !== undefined ? { createdWithAgent: meta.createdWithAgent } : {}),
    ...(meta?.pendingFirstAgentMessageRename !== undefined
      ? { pendingFirstAgentMessageRename: meta.pendingFirstAgentMessageRename }
      : {}),
    ...(git.isSparse === true
      ? {
          sparseDirectories: meta?.sparseDirectories,
          sparseBaseRef: meta?.sparseBaseRef,
          sparsePresetId: meta?.sparsePresetId
        }
      : {}),
    ...(meta?.baseRef !== undefined ? { baseRef: meta.baseRef } : {}),
    ...(meta?.pushTarget !== undefined ? { pushTarget: meta.pushTarget } : {}),
    workspaceStatus: meta?.workspaceStatus ?? DEFAULT_WORKSPACE_STATUS_ID,
    // Why: diff comments are persisted on WorktreeMeta (see `WorktreeMeta` in
    // shared/types) and forwarded verbatim so the renderer store mirrors
    // on-disk state. `undefined` here means the worktree has no comments yet.
    diffComments: meta?.diffComments
  }
}

/**
 * Parse a composite worktreeId ("repoId::worktreePath") into its parts.
 */
export function parseWorktreeId(worktreeId: string): { repoId: string; worktreePath: string } {
  const parsed = splitWorktreeId(worktreeId)
  if (!parsed) {
    throw new Error(`Invalid worktreeId: ${worktreeId}`)
  }
  return parsed
}

/**
 * Check whether a git error indicates the worktree is no longer tracked by git.
 * This happens when a worktree's internal git tracking is removed (e.g. via
 * `git worktree prune`) but the directory still exists on disk.
 */
export function isOrphanedWorktreeError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  const msg = (error as { stderr?: string }).stderr || error.message
  return /is not a working tree/.test(msg)
}

export function isOrphanCompatiblePreflightError(error: unknown): boolean {
  if (isOrphanedWorktreeError(error)) {
    return true
  }
  if (!(error instanceof Error)) {
    return false
  }
  const errorWithDetails = error as Error & { code?: unknown; stderr?: string; stdout?: string }
  const details = [
    errorWithDetails.stderr,
    errorWithDetails.stdout,
    errorWithDetails.message,
    typeof errorWithDetails.code === 'string' ? errorWithDetails.code : undefined
  ]
    .filter((value): value is string => Boolean(value))
    .join('\n')
  return /not a git repository/i.test(details) || /\bENOENT\b/i.test(details)
}

/**
 * Format a human-readable error message for worktree removal failures.
 */
export function formatWorktreeRemovalError(
  error: unknown,
  worktreePath: string,
  force: boolean
): string {
  const fallback = force
    ? `Failed to force delete worktree at ${worktreePath}.`
    : `Failed to delete worktree at ${worktreePath}.`

  if (!(error instanceof Error)) {
    return fallback
  }

  const errorWithStreams = error as Error & { stderr?: string; stdout?: string }
  const details = [errorWithStreams.stderr, errorWithStreams.stdout, error.message]
    .map((value) => value?.trim())
    .find(Boolean)

  return details ? `${fallback} ${details}` : fallback
}
