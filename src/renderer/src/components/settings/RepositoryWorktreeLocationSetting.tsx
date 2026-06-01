import { useCallback, useEffect, useState } from 'react'
import type { Repo } from '../../../../shared/types'
import { FolderOpen } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { SearchableSetting } from './SearchableSetting'
import { useAppStore } from '../../store'

type WorktreeLocationSettingProps = {
  repo: Repo
  updateRepo: (repoId: string, updates: Partial<Repo>) => void | Promise<boolean>
  placeholder: string
  forceVisible: boolean
}

export function WorktreeLocationSetting({
  repo,
  updateRepo,
  placeholder,
  forceVisible
}: WorktreeLocationSettingProps): React.JSX.Element {
  const activeRuntimeEnvironmentId = useAppStore(
    (state) => state.settings?.activeRuntimeEnvironmentId ?? null
  )
  const currentPath = repo.worktreeBasePath ?? repo.worktreeFolderPath ?? ''
  const [draftPath, setDraftPath] = useState(currentPath)
  const [saving, setSaving] = useState(false)
  const canBrowse = canBrowseProjectWorktreeFolder(repo, activeRuntimeEnvironmentId)

  useEffect(() => {
    setDraftPath(repo.worktreeBasePath ?? repo.worktreeFolderPath ?? '')
  }, [repo.id, repo.worktreeBasePath, repo.worktreeFolderPath])

  const commitDraft = useCallback(
    async (nextPath = draftPath): Promise<void> => {
      const trimmed = nextPath.trim()
      const currentRepoPath = repo.worktreeBasePath ?? repo.worktreeFolderPath ?? ''
      if (trimmed === currentRepoPath) {
        setDraftPath(currentRepoPath)
        return
      }
      setSaving(true)
      try {
        const result = await updateRepo(repo.id, {
          worktreeBasePath: trimmed || undefined,
          worktreeFolderPath: undefined
        })
        setDraftPath(result === false ? currentRepoPath : trimmed)
      } finally {
        setSaving(false)
      }
    },
    [draftPath, repo.id, repo.worktreeBasePath, repo.worktreeFolderPath, updateRepo]
  )

  const clearLocation = (): void => {
    void updateRepo(repo.id, {
      worktreeBasePath: undefined,
      worktreeFolderPath: undefined
    })
  }

  const handleBrowse = async (): Promise<void> => {
    const path = await window.api.repos.pickDirectory()
    if (path) {
      setDraftPath(path)
      await commitDraft(path)
    }
  }

  return (
    <SearchableSetting
      title="Worktree Location"
      description="Project-specific directory for new worktrees."
      keywords={[
        repo.displayName,
        repo.path,
        'worktree folder',
        'workspace folder',
        'worktree path',
        'workspace path',
        'directory',
        'relative',
        '../worktrees'
      ]}
      className="space-y-2"
      forceVisible={forceVisible}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm font-semibold">Worktree Location</Label>
          {currentPath ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearLocation}>
              Use Global
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Relative paths resolve from this project root.
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
          placeholder={placeholder}
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
