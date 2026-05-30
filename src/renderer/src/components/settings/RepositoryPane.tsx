import { useCallback, useEffect, useRef, useState } from 'react'
import type { OrcaHooks, Repo, RepoHookSettings } from '../../../../shared/types'
import { getRepoKindLabel, isFolderRepo } from '../../../../shared/repo-kind'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Separator } from '../ui/separator'
import { FolderOpen, Trash2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { BaseRefPicker } from './BaseRefPicker'
import { RepositoryHooksSection } from './RepositoryHooksSection'
import { McpConfigSection } from './McpConfigSection'
import { WorktreeSymlinksSection } from './WorktreeSymlinksSection'
import { SparsePresetSettingsSection } from './SparsePresetSettingsSection'
import { RepositorySourceControlAiSection } from './RepositorySourceControlAiSection'
import { SearchableSetting } from './SearchableSetting'
import { matchesSettingsSearch, normalizeSettingsSearchQuery } from './settings-search'
import { useAppStore } from '../../store'
import { getRepositoryIconSectionId } from './repository-settings-targets'
import { RepositoryIconPicker } from './RepositoryIconPicker'
import { getRepositoryPaneSearchEntries } from './repository-search'
export { getRepositoryPaneSearchEntries }

type RepositoryPaneProps = {
  repo: Repo
  yamlHooks: OrcaHooks | null
  hasHooksFile: boolean
  hooksInspectionReady: boolean
  mayNeedUpdate: boolean
  updateRepo: (repoId: string, updates: Partial<Repo>) => void | Promise<boolean>
  removeProject: (repoId: string) => void
}

export function matchesRepositoryIdentitySearch(query: string, repo: Repo): boolean {
  const normalizedQuery = normalizeSettingsSearchQuery(query)
  if (!normalizedQuery) {
    return false
  }
  return [repo.displayName, repo.path].some((value) =>
    value.toLowerCase().includes(normalizedQuery)
  )
}

export function RepositoryPane({
  repo,
  yamlHooks,
  hasHooksFile,
  hooksInspectionReady,
  mayNeedUpdate,
  updateRepo,
  removeProject
}: RepositoryPaneProps): React.JSX.Element {
  const isFolder = isFolderRepo(repo)
  const searchQuery = useAppStore((state) => state.settingsSearchQuery)
  const symlinksEnabled = useAppStore((state) => state.settings?.experimentalWorktreeSymlinks)
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null)
  const [copiedTemplate, setCopiedTemplate] = useState(false)
  const copiedTemplateResetTimerRef = useRef<number | null>(null)
  // Why: clipboard IPC can resolve after settings navigation; avoid starting
  // a reset timer that will outlive this pane.
  const isMountedRef = useRef(false)
  // Why: searching a project name is navigation to that project, not a
  // request to hide every child row that does not repeat the project name.
  const forceFullPaneForRepoMatch = matchesRepositoryIdentitySearch(searchQuery, repo)

  const clearCopiedTemplateResetTimer = useCallback((): void => {
    if (copiedTemplateResetTimerRef.current !== null) {
      window.clearTimeout(copiedTemplateResetTimerRef.current)
      copiedTemplateResetTimerRef.current = null
    }
  }, [])

  const setRepositoryPaneRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      isMountedRef.current = node !== null
      if (node === null) {
        clearCopiedTemplateResetTimer()
      }
    },
    [clearCopiedTemplateResetTimer]
  )

  const handleRemoveProject = (repoId: string) => {
    if (confirmingRemove === repoId) {
      removeProject(repoId)
      setConfirmingRemove(null)
      return
    }

    setConfirmingRemove(repoId)
  }

  const updateSelectedRepoHookSettings = (nextSettings: RepoHookSettings) => {
    updateRepo(repo.id, {
      hookSettings: nextSettings
    })
  }

  const handleCopyTemplate = async () => {
    // Why: the missing-`orca.yaml` state is a migration aid, so copying the shared-template
    // snippet should be one click rather than forcing users to reconstruct the expected shape.
    await window.api.ui.writeClipboardText(`scripts:
  setup: |
    pnpm worktree:setup
  archive: |
    echo "Cleaning up before archive"`)
    if (!isMountedRef.current) {
      return
    }
    clearCopiedTemplateResetTimer()
    setCopiedTemplate(true)
    copiedTemplateResetTimerRef.current = window.setTimeout(() => {
      copiedTemplateResetTimerRef.current = null
      setCopiedTemplate(false)
    }, 1500)
  }

  const allEntries = getRepositoryPaneSearchEntries(repo)
  const identityEntries = allEntries.filter((entry) =>
    [
      'Display Name',
      'Project Icon',
      'Default Worktree Base',
      'Worktree Folder',
      'Remove Project'
    ].includes(entry.title)
  )
  const sparsePresetEntries = allEntries.filter((entry) =>
    ['Sparse Checkout Presets'].includes(entry.title)
  )
  const hooksEntries = allEntries.filter((entry) =>
    [
      'Setup Script',
      'Archive Script',
      'Advanced',
      'When to Run Setup',
      'Custom GitHub Issue Command'
    ].includes(entry.title)
  )
  const mcpEntries = allEntries.filter((entry) => entry.title === 'MCP Configs')
  const symlinkEntries = allEntries.filter((entry) => entry.title === 'Worktree Symlinks')
  const sourceControlAiEntries = allEntries.filter((entry) => entry.title === 'Source Control AI')
  const removeProjectLabel =
    confirmingRemove === repo.id ? 'Confirm Remove Project' : 'Remove Project'

  const hooksSection =
    !isFolder && (forceFullPaneForRepoMatch || matchesSettingsSearch(searchQuery, hooksEntries)) ? (
      <RepositoryHooksSection
        key="hooks"
        repo={repo}
        yamlHooks={yamlHooks}
        hasHooksFile={hasHooksFile}
        hooksInspectionReady={hooksInspectionReady}
        mayNeedUpdate={mayNeedUpdate}
        copiedTemplate={copiedTemplate}
        forceVisible={forceFullPaneForRepoMatch}
        onCopyTemplate={() => void handleCopyTemplate()}
        onUpdateHookSettings={updateSelectedRepoHookSettings}
      />
    ) : null

  // Why: Identity (name, icon, base ref) stays at the top so it's the first
  // thing a user sees. Setup commands follow immediately because they're the
  // most-edited surface and should beat MCP/symlinks/sparse-presets.
  const visibleSections = [
    forceFullPaneForRepoMatch || matchesSettingsSearch(searchQuery, identityEntries) ? (
      <section key="identity" className="relative space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 pr-12">
            <h3 className="text-sm font-semibold">Identity</h3>
            <p className="text-xs text-muted-foreground">
              Project-specific display details for the sidebar and tabs.
            </p>
            <p className="text-xs text-muted-foreground">
              Type: <span className="text-foreground">{getRepoKindLabel(repo)}</span>
            </p>
            {isFolder ? (
              <p className="text-xs text-muted-foreground">
                Opened as folder. Git features are unavailable for this workspace.
              </p>
            ) : null}
          </div>
          <SearchableSetting
            title="Remove Project"
            description="Remove this project from Orca."
            keywords={[repo.displayName, 'delete', 'project', 'repository']}
            className="absolute top-0 right-0 z-10 w-auto max-w-none"
            forceVisible={forceFullPaneForRepoMatch}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={confirmingRemove === repo.id ? 'destructive' : 'outline'}
                  size="icon-sm"
                  onClick={() => handleRemoveProject(repo.id)}
                  onBlur={() => setConfirmingRemove(null)}
                  aria-label={removeProjectLabel}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                {removeProjectLabel}
              </TooltipContent>
            </Tooltip>
          </SearchableSetting>
        </div>

        <SearchableSetting
          title="Display Name"
          description="Project-specific display details for the sidebar and tabs."
          keywords={[repo.displayName, repo.path, 'project name', 'repository name']}
          className="space-y-2"
          forceVisible={forceFullPaneForRepoMatch}
        >
          <Label className="text-sm font-semibold">Display Name</Label>
          <Input
            value={repo.displayName}
            onChange={(e) =>
              updateRepo(repo.id, {
                displayName: e.target.value
              })
            }
            className="h-9 text-sm"
          />
        </SearchableSetting>

        <SearchableSetting
          title="Project Icon"
          description="Project icon and color used in the sidebar and tabs."
          keywords={[
            repo.displayName,
            repo.path,
            'project icon',
            'repository icon',
            'color',
            'badge',
            'emoji',
            'favicon'
          ]}
          className="space-y-2"
          id={getRepositoryIconSectionId(repo.id)}
          forceVisible={forceFullPaneForRepoMatch}
        >
          <RepositoryIconPicker repo={repo} updateRepo={updateRepo} />
        </SearchableSetting>

        {!isFolder ? (
          <>
            <SearchableSetting
              title="Default Worktree Base"
              description="Default base branch or ref when creating worktrees."
              keywords={[repo.displayName, 'base ref', 'branch']}
              className="space-y-3"
              forceVisible={forceFullPaneForRepoMatch}
            >
              <Label className="text-sm font-semibold">Default Worktree Base</Label>
              <BaseRefPicker
                repoId={repo.id}
                currentBaseRef={repo.worktreeBaseRef}
                onSelect={(ref) => updateRepo(repo.id, { worktreeBaseRef: ref })}
                onUsePrimary={() => updateRepo(repo.id, { worktreeBaseRef: undefined })}
              />
            </SearchableSetting>
            <WorktreeFolderSetting
              repo={repo}
              updateRepo={updateRepo}
              forceVisible={forceFullPaneForRepoMatch}
            />
          </>
        ) : null}
      </section>
    ) : null,
    hooksSection,
    !isFolder &&
    (forceFullPaneForRepoMatch || matchesSettingsSearch(searchQuery, sourceControlAiEntries)) ? (
      <RepositorySourceControlAiSection
        key="source-control-ai"
        repo={repo}
        updateRepo={updateRepo}
      />
    ) : null,
    !isFolder &&
    !repo.connectionId &&
    symlinksEnabled &&
    (forceFullPaneForRepoMatch || matchesSettingsSearch(searchQuery, symlinkEntries)) ? (
      <WorktreeSymlinksSection key="symlinks" repo={repo} updateRepo={updateRepo} />
    ) : null,
    !isFolder &&
    (forceFullPaneForRepoMatch || matchesSettingsSearch(searchQuery, sparsePresetEntries)) ? (
      <SparsePresetSettingsSection key="sparse-presets" repoId={repo.id} />
    ) : null,
    !isFolder && (forceFullPaneForRepoMatch || matchesSettingsSearch(searchQuery, mcpEntries)) ? (
      <McpConfigSection key="mcp-configs" repo={repo} />
    ) : null
  ].filter(Boolean)

  return (
    <div ref={setRepositoryPaneRootRef} className="space-y-8">
      {visibleSections.map((section, index) => (
        <div key={index} className="space-y-8">
          {index > 0 ? <Separator /> : null}
          {section}
        </div>
      ))}
    </div>
  )
}

function WorktreeFolderSetting({
  repo,
  updateRepo,
  forceVisible
}: {
  repo: Repo
  updateRepo: (repoId: string, updates: Partial<Repo>) => void | Promise<boolean>
  forceVisible: boolean
}): React.JSX.Element {
  const activeRuntimeEnvironmentId = useAppStore(
    (state) => state.settings?.activeRuntimeEnvironmentId ?? null
  )
  const [draftPath, setDraftPath] = useState(repo.worktreeFolderPath ?? '')
  const [saving, setSaving] = useState(false)
  const canBrowse = canBrowseProjectWorktreeFolder(repo, activeRuntimeEnvironmentId)

  useEffect(() => {
    setDraftPath(repo.worktreeFolderPath ?? '')
  }, [repo.id, repo.worktreeFolderPath])

  const commitDraft = useCallback(
    async (nextPath = draftPath): Promise<void> => {
      const trimmed = nextPath.trim()
      if (trimmed === (repo.worktreeFolderPath ?? '')) {
        setDraftPath(repo.worktreeFolderPath ?? '')
        return
      }
      setSaving(true)
      try {
        const result = await updateRepo(repo.id, { worktreeFolderPath: trimmed })
        if (result === false) {
          setDraftPath(repo.worktreeFolderPath ?? '')
          return
        }
        setDraftPath(trimmed)
      } finally {
        setSaving(false)
      }
    },
    [draftPath, repo.id, repo.worktreeFolderPath, updateRepo]
  )

  const handleBrowse = async (): Promise<void> => {
    const path = await window.api.repos.pickDirectory()
    if (!path) {
      return
    }
    setDraftPath(path)
    await commitDraft(path)
  }

  return (
    <SearchableSetting
      title="Worktree Folder"
      description="Optional folder for new worktrees from this project."
      keywords={[repo.displayName, repo.path, 'worktree folder', 'workspace folder', 'directory']}
      className="space-y-2"
      forceVisible={forceVisible}
    >
      <div className="space-y-1">
        <Label className="text-sm font-semibold">Worktree Folder</Label>
        <p className="text-xs text-muted-foreground">
          Blank inherits the global workspace folder for local projects, including WSL defaults, or
          the repo sibling folder for SSH projects.
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          value={draftPath}
          onChange={(event) => setDraftPath(event.target.value)}
          onBlur={() => void commitDraft()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void commitDraft()
            }
          }}
          placeholder="Inherit default"
          className="h-9 text-sm"
        />
        {canBrowse ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void handleBrowse()}
            disabled={saving}
          >
            <FolderOpen className="size-4" />
            Browse
          </Button>
        ) : null}
      </div>
    </SearchableSetting>
  )
}

export function canBrowseProjectWorktreeFolder(
  repo: Repo,
  activeRuntimeEnvironmentId: string | null | undefined
): boolean {
  return !repo.connectionId && !activeRuntimeEnvironmentId?.trim()
}
