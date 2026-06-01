import { posix, win32 } from 'path'
import type { GlobalSettings, OrcaWorkspaceLayout, Repo } from '../../shared/types'
import { resolveRuntimePath } from '../../shared/cross-platform-path'
import { isWslUncPath } from '../../shared/wsl-paths'
import { getWslHome, parseWslPath } from '../wsl'
import { normalizeRepoWorktreeFolderPath } from '../repo-worktree-folder-path'

type WorktreePathSettings = Pick<GlobalSettings, 'nestWorkspaces' | 'workspaceDir'>
type WorktreeBasePathRepo = Pick<Repo, 'path' | 'kind' | 'worktreeBasePath' | 'worktreeFolderPath'>

export type EffectiveWorktreeLayout = OrcaWorkspaceLayout & {
  source: 'project' | 'wsl-default' | 'global'
}

export type RemoteWorktreeLayout = OrcaWorkspaceLayout & {
  source: 'project' | 'ssh-sibling'
}

export function ensurePathWithinWorkspace(targetPath: string, workspaceDir: string): string {
  const pathOps = getWorktreePathOps(targetPath, workspaceDir)
  const resolvedWorkspaceDir = pathOps.resolve(workspaceDir)
  const resolvedTargetPath = pathOps.resolve(targetPath)
  const rel = pathOps.relative(resolvedWorkspaceDir, resolvedTargetPath)

  if (pathOps.isAbsolute(rel) || rel === '..' || rel.startsWith(`..${pathOps.sep}`)) {
    throw new Error('Invalid worktree path')
  }

  return resolvedTargetPath
}

export function computeWorktreePath(
  sanitizedName: string,
  repoPath: string,
  settings: WorktreePathSettings
): string {
  const workspaceRoot = computeWorkspaceRoot(repoPath, settings)
  const pathOps = getRuntimePathOps(repoPath, workspaceRoot)

  if (settings.nestWorkspaces) {
    const repoName = pathOps.basename(repoPath).replace(/\.git$/, '')
    return pathOps.join(workspaceRoot, repoName, sanitizedName)
  }
  return pathOps.join(workspaceRoot, sanitizedName)
}

export function computeWorkspaceRoot(repoPath: string, settings: { workspaceDir: string }): string {
  const wsl = parseWslPath(repoPath)
  if (wsl && shouldMirrorWorkspaceDirInsideWsl(repoPath, settings.workspaceDir)) {
    const wslHome = getWslHome(wsl.distro)
    if (wslHome) {
      // Why: WSL UNC paths are still Windows paths from Node's perspective.
      // Mirror desktop workspace roots inside the distro so terminals stay on WSL.
      return win32.join(wslHome, 'orca', 'workspaces')
    }
  }
  return resolveWorkspaceDirForRepo(repoPath, settings.workspaceDir)
}

export function computeRemoteWorktreePath(
  sanitizedName: string,
  repo: Pick<Repo, 'path' | 'kind' | 'worktreeFolderPath'>
): string
export function computeRemoteWorktreePath(
  sanitizedName: string,
  repoPath: string,
  settings: WorktreePathSettings,
  options?: { useConfiguredAbsolutePath?: boolean }
): string
export function computeRemoteWorktreePath(
  sanitizedName: string,
  repoOrPath: string | Pick<Repo, 'path' | 'kind' | 'worktreeFolderPath'>,
  settings?: WorktreePathSettings,
  options: { useConfiguredAbsolutePath?: boolean } = {}
): string {
  if (typeof repoOrPath !== 'string') {
    const layout = resolveRemoteWorktreeLayout(repoOrPath)
    return computeWorktreePathForLayout(sanitizedName, repoOrPath.path, layout)
  }
  if (!settings) {
    throw new Error('Remote worktree path settings are required.')
  }
  if (
    options.useConfiguredAbsolutePath ||
    isWorkspaceDirRelativeToRepo(repoOrPath, settings.workspaceDir)
  ) {
    return computeWorktreePath(sanitizedName, repoOrPath, settings)
  }
  // Why: absolute global workspaceDir values belong to the desktop machine.
  // SSH worktrees keep the legacy repo-sibling root unless a repo-specific path opts in.
  return getRuntimePathOps(repoOrPath, repoOrPath).join(repoOrPath, '..', sanitizedName)
}

export function getWorktreePathSettings(
  repo: WorktreeBasePathRepo,
  settings: WorktreePathSettings
): WorktreePathSettings {
  const projectPath = getRepoWorktreeFolderPath(repo)
  if (projectPath) {
    return { nestWorkspaces: false, workspaceDir: projectPath }
  }
  return {
    nestWorkspaces: settings.nestWorkspaces,
    workspaceDir: getRepoWorktreeBasePath(repo) ?? settings.workspaceDir
  }
}

export function getWorktreeCreationLayout(
  repo: WorktreeBasePathRepo,
  settings: WorktreePathSettings
): OrcaWorkspaceLayout {
  const worktreePathSettings = getWorktreePathSettings(repo, settings)
  return {
    path: worktreePathSettings.workspaceDir,
    nestWorkspaces: worktreePathSettings.nestWorkspaces
  }
}

export function hasRepoWorktreeBasePath(
  repo: Pick<Repo, 'path' | 'kind' | 'worktreeBasePath' | 'worktreeFolderPath'>
): boolean {
  return (
    getRepoWorktreeBasePath(repo) !== undefined ||
    getRepoWorktreeFolderPath(repo) !== undefined
  )
}

export function resolveEffectiveWorktreeLayout(
  repo: WorktreeBasePathRepo,
  settings: WorktreePathSettings
): EffectiveWorktreeLayout {
  const projectPath = getRepoWorktreeFolderPath(repo)
  if (projectPath) {
    return { path: projectPath, nestWorkspaces: false, source: 'project' }
  }

  const worktreePathSettings = getWorktreePathSettings(repo, settings)
  const workspaceRoot = computeWorkspaceRoot(repo.path, worktreePathSettings)
  const wsl = parseWslPath(repo.path)
  return {
    path: workspaceRoot,
    nestWorkspaces: worktreePathSettings.nestWorkspaces,
    source:
      wsl && workspaceRoot !== resolveWorkspaceDirForRepo(repo.path, worktreePathSettings.workspaceDir)
        ? 'wsl-default'
        : 'global'
  }
}

export function resolveRemoteWorktreeLayout(
  repo: Pick<Repo, 'path' | 'kind' | 'worktreeFolderPath'>
): RemoteWorktreeLayout {
  const projectPath = getRepoWorktreeFolderPath(repo)
  if (projectPath) {
    return { path: projectPath, nestWorkspaces: false, source: 'project' }
  }

  const pathOps = getWorktreePathOps(repo.path)
  return {
    path: pathOps.dirname(repo.path),
    nestWorkspaces: false,
    source: 'ssh-sibling'
  }
}

export function computeWorktreePathForLayout(
  sanitizedName: string,
  repoPath: string,
  layout: Pick<OrcaWorkspaceLayout, 'path' | 'nestWorkspaces'>
): string {
  return computeWorktreePath(sanitizedName, repoPath, {
    workspaceDir: layout.path,
    nestWorkspaces: layout.nestWorkspaces
  })
}

function getWorktreePathOps(...paths: string[]) {
  return paths.some(looksLikeWindowsPath) ? win32 : posix
}

function getRuntimePathOps(
  repoPath: string,
  workspaceDir: string
): Pick<typeof posix, 'basename' | 'isAbsolute' | 'join' | 'normalize'> {
  return looksLikeWindowsPath(repoPath) || looksLikeWindowsPath(workspaceDir) ? win32 : posix
}

function resolveWorkspaceDirForRepo(repoPath: string, workspaceDir: string): string {
  const pathOps = getRuntimePathOps(repoPath, workspaceDir)
  return pathOps.isAbsolute(workspaceDir)
    ? pathOps.normalize(workspaceDir)
    : resolveRuntimePath(repoPath, workspaceDir)
}

function isWorkspaceDirRelativeToRepo(repoPath: string, workspaceDir: string): boolean {
  return !getRuntimePathOps(repoPath, workspaceDir).isAbsolute(workspaceDir)
}

function getRepoWorktreeBasePath(repo: Pick<Repo, 'worktreeBasePath'>): string | undefined {
  const trimmed = repo.worktreeBasePath?.trim()
  return trimmed || undefined
}

function getRepoWorktreeFolderPath(
  repo: Pick<Repo, 'path' | 'kind' | 'worktreeFolderPath'> | undefined
): string | undefined {
  return repo ? normalizeRepoWorktreeFolderPath(repo.worktreeFolderPath, repo) : undefined
}

function shouldMirrorWorkspaceDirInsideWsl(repoPath: string, workspaceDir: string): boolean {
  if (isWorkspaceDirRelativeToRepo(repoPath, workspaceDir)) {
    return false
  }
  return !isWslUncPath(workspaceDir)
}

function looksLikeWindowsPath(pathValue: string): boolean {
  return (
    /^[A-Za-z]:[\\/]/.test(pathValue) || pathValue.startsWith('\\\\') || pathValue.startsWith('//')
  )
}
