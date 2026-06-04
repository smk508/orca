import { type Dispatch, type SetStateAction } from 'react'
import { ArrowLeft, CircleStop, Loader2 } from 'lucide-react'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { NestedRepoChecklist } from '@/components/repo/NestedRepoChecklist'
import type { NestedRepoScanResult } from '../../../../shared/types'
import { NestedRepoScanLimitNotice } from '../repo/NestedRepoScanLimitNotice'
import { getRuntimePathBasename } from '../../../../shared/cross-platform-path'

type AddRepoNestedImportStepProps = {
  scan: NestedRepoScanResult
  groupName: string
  selectedPaths: Set<string>
  isAdding: boolean
  scanInProgress: boolean
  onGroupNameChange: (value: string) => void
  onSelectedPathsChange: Dispatch<SetStateAction<Set<string>>>
  onBack: () => void
  onImport: (mode: 'group' | 'separate') => void
  onStopScan: () => void
}

export function AddRepoNestedImportStep({
  scan,
  groupName,
  selectedPaths,
  isAdding,
  scanInProgress,
  onGroupNameChange,
  onSelectedPathsChange,
  onBack,
  onImport,
  onStopScan
}: AddRepoNestedImportStepProps): React.JSX.Element {
  const folderName = getRuntimePathBasename(scan.selectedPath) || scan.selectedPath

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import repositories from folder</DialogTitle>
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {scanInProgress ? <AddRepoNestedImportStopButton onStopScan={onStopScan} /> : null}
            <DialogDescription className="min-w-0 truncate">
              {`${scanInProgress ? 'Scanning... ' : ''}Found ${scan.repos.length} ${
                scan.repos.length === 1 ? 'repository' : 'repositories'
              } in this folder.`}
            </DialogDescription>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            Scanned folder: {folderName} · {scan.selectedPath}
          </div>
        </div>
      </DialogHeader>

      <div className="flex min-h-0 min-w-0 max-w-full flex-col gap-3 overflow-hidden pt-1">
        <NestedRepoChecklist
          scan={scan}
          selectedPaths={selectedPaths}
          onSelectedPathsChange={onSelectedPathsChange}
          disabled={isAdding || scanInProgress}
          className="flex-1"
        />
        {scanInProgress || scan.truncated || scan.timedOut || scan.stopped ? (
          <NestedRepoScanLimitNotice scan={scan} />
        ) : null}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button onClick={onBack} disabled={isAdding && !scanInProgress} variant="ghost">
            <ArrowLeft className="size-3.5" />
            Back
          </Button>
          <div className="ml-auto flex min-w-0 flex-wrap justify-end gap-2">
            <Button
              onClick={() => onImport('separate')}
              disabled={isAdding || scanInProgress || selectedPaths.size === 0}
              variant="outline"
            >
              Import separately
            </Button>
            <div className="flex min-w-0 flex-wrap justify-end gap-2">
              <Input
                aria-label="Group name"
                value={groupName}
                onChange={(event) => onGroupNameChange(event.target.value)}
                disabled={isAdding || scanInProgress}
                className="h-9 w-36 min-w-0"
                placeholder={folderName}
              />
              <Button
                onClick={() => onImport('group')}
                disabled={isAdding || scanInProgress || selectedPaths.size === 0}
              >
                Import as group
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function AddRepoNestedImportStopButton({
  onStopScan
}: {
  onStopScan: () => void
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="group text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive focus-visible:ring-destructive/40"
          aria-label="Stop scan"
          title="Stop scanning"
          onClick={onStopScan}
        >
          <Loader2 className="size-3.5 animate-spin text-annotation-highlight group-hover:hidden group-focus-visible:hidden" />
          <CircleStop className="hidden size-3.5 group-hover:block group-focus-visible:block" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        Scanning repositories. Click to stop.
      </TooltipContent>
    </Tooltip>
  )
}
