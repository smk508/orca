import type { JSX, ReactNode } from 'react'
import {
  BellRing,
  Bot,
  Check,
  CircleDot,
  FolderGit2,
  Github,
  Globe2,
  MonitorCog,
  Terminal,
  Workflow
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LinearIcon } from '@/components/icons/LinearIcon'

// Why: these static marks replace storyboarded animations for setup steps whose
// meaning reads instantly as a single mark — quieter than a looping demo.
// Each compresses its step to one recognizable idea drawn from the old animation.

// A green ✓ + skeleton line: the agent-action checklist beat shared by terminal marks.
function CheckLine(props: { className?: string }): JSX.Element {
  return (
    <span className={cn('flex items-center gap-1.5', props.className)}>
      <Check className="size-3 shrink-0 text-emerald-500" strokeWidth={3} />
      <span className="h-[5px] flex-1 rounded-full bg-foreground/10" />
    </span>
  )
}

// Mac-style terminal traffic-light dots — the signature of an Orca terminal pane.
function TerminalDots(): JSX.Element {
  return (
    <span className="flex gap-[3px]">
      <span className="size-[5px] rounded-full bg-foreground/15" />
      <span className="size-[5px] rounded-full bg-foreground/15" />
      <span className="size-[5px] rounded-full bg-foreground/15" />
    </span>
  )
}

// Split a terminal: one terminal split into two panes, each running an agent.
export function SetupTwoAgentsVisual(): JSX.Element {
  return (
    <div aria-hidden className="relative h-24 w-[132px] shrink-0">
      <div className="absolute inset-y-1 inset-x-0 flex flex-col overflow-hidden rounded-[10px] border-[1.5px] border-border bg-card shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
        <div className="flex items-center border-b border-border px-2 py-1.5">
          <TerminalDots />
        </div>
        <div className="flex flex-1">
          <SplitTerminalPane />
          <SplitTerminalPane className="border-l-[1.5px] border-border" />
        </div>
      </div>
    </div>
  )
}

function SplitTerminalPane(props: { className?: string }): JSX.Element {
  return (
    <div className={cn('flex flex-1 flex-col gap-1.5 p-2', props.className)}>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] leading-none text-muted-foreground">{'>'}</span>
        <span className="h-[5px] w-3/5 rounded-full bg-foreground/10" />
      </span>
      <CheckLine className="w-4/5" />
    </div>
  )
}

// Choose a default agent: one selected agent profile with the same completion
// language used throughout the guide.
export function SetupDefaultAgentVisual(): JSX.Element {
  return (
    <div
      aria-hidden
      className="flex w-[132px] shrink-0 items-center gap-2.5 rounded-[10px] border-[1.5px] border-border bg-card p-2.5 shadow-[0_6px_16px_rgba(0,0,0,0.12)]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-emerald-500/45 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
        <Bot className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="h-[5px] w-4/5 rounded-full bg-foreground/10" />
        <CheckLine className="w-3/4" />
      </span>
    </div>
  )
}

// Turn on notifications: one completed alert routed back to the user.
export function SetupNotificationsVisual(): JSX.Element {
  return (
    <div aria-hidden className="relative flex h-24 w-[132px] shrink-0 items-center justify-center">
      <span className="absolute right-5 top-4 size-3 rounded-full bg-emerald-500 ring-[5px] ring-emerald-500/10" />
      <span className="flex size-[58px] items-center justify-center rounded-[14px] border-[1.5px] border-border bg-card text-muted-foreground shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
        <BellRing className="size-6" />
      </span>
    </div>
  )
}

// Why: a small, static mark of two parallel worktrees — quieter than an animated
// storyboard, which read as cluttered for a step whose meaning is just "two isolated spaces."
export function SetupWorkspacesVisual(): JSX.Element {
  return (
    <div aria-hidden className="relative h-24 w-[132px] shrink-0">
      <WorktreeGlyphPanel className="right-0 top-0 bg-muted/30" />
      <WorktreeGlyphPanel className="bottom-0 left-0 bg-card shadow-[0_6px_16px_rgba(0,0,0,0.12)]" />
    </div>
  )
}

function WorktreeGlyphPanel(props: { className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        'absolute flex h-[60px] w-[92px] items-start gap-2 rounded-[10px] border border-border p-2.5',
        props.className
      )}
    >
      <span className="mt-0.5 size-2 shrink-0 rounded-full bg-emerald-500 ring-[3px] ring-emerald-500/10" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="h-[5px] w-4/5 rounded-full bg-foreground/10" />
        <span className="h-[5px] w-1/2 rounded-full bg-foreground/10" />
      </span>
    </div>
  )
}

// Connect integrations: a small issue list like the Tasks page — one open
// GitHub issue, one open Linear issue, each with the open-state CircleDot and #.
export function SetupIntegrationsVisual(): JSX.Element {
  return (
    <div
      aria-hidden
      className="flex w-[132px] shrink-0 flex-col justify-center gap-1.5 rounded-[10px] border-[1.5px] border-border bg-card p-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.12)]"
    >
      <IssueRow source={<Github className="size-[13px]" />} titleWidth="w-3/5" />
      <IssueRow
        source={<LinearIcon className="size-[13px]" />}
        titleWidth="w-[70%]"
        className="border-t border-border"
      />
    </div>
  )
}

function IssueRow(props: {
  source: ReactNode
  titleWidth: string
  className?: string
}): JSX.Element {
  return (
    <span className={cn('flex items-center gap-[7px] px-1.5 py-1', props.className)}>
      <span className="shrink-0 text-muted-foreground">{props.source}</span>
      <span className="flex shrink-0 items-center gap-[3px] font-mono text-[9px] font-semibold text-muted-foreground">
        <CircleDot className="size-[11px] text-emerald-500" />#
      </span>
      <span className={cn('h-[5px] rounded-full bg-foreground/10', props.titleWidth)} />
    </span>
  )
}

// Start work in multiple repos: two project cards, each a folder + name and a
// live worktree row (emerald dot) — your repos, each running their own work.
export function SetupMultipleReposVisual(): JSX.Element {
  return (
    <div aria-hidden className="flex w-[132px] shrink-0 items-stretch gap-2">
      <RepoCard nameWidth="w-[62%]" worktreeWidth="w-[78%]" />
      <RepoCard nameWidth="w-[70%]" worktreeWidth="w-[66%]" />
    </div>
  )
}

function RepoCard(props: { nameWidth: string; worktreeWidth: string }): JSX.Element {
  return (
    <div className="flex flex-1 flex-col gap-[7px] rounded-[9px] border-[1.5px] border-emerald-500/35 bg-card p-2 shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
      <span className="flex items-center gap-1.5">
        <FolderGit2 className="size-[13px] shrink-0 text-muted-foreground" />
        <span className={cn('h-[5px] rounded-full bg-foreground/10', props.nameWidth)} />
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 shrink-0 rounded-full bg-emerald-500 ring-[3px] ring-emerald-500/10" />
        <span className={cn('h-[5px] rounded-full bg-foreground/10', props.worktreeWidth)} />
      </span>
    </div>
  )
}

// Enable Orca CLI: the three CLI capabilities (browser, computer, orchestration)
// switched on, fronted by a $ command bar — abilities you turn on via the CLI.
export function SetupOrcaCliVisual(): JSX.Element {
  return (
    <div
      aria-hidden
      className="flex w-[132px] shrink-0 flex-col items-center justify-center gap-2.5"
    >
      <span className="flex gap-2">
        <CapabilityTile icon={<Globe2 className="size-[17px]" />} />
        <CapabilityTile icon={<MonitorCog className="size-[17px]" />} />
        <CapabilityTile icon={<Workflow className="size-[17px]" />} />
      </span>
      <span className="flex items-center gap-1.5 rounded-full border-[1.5px] border-border bg-card px-2.5 py-1">
        <span className="font-mono text-[11px] font-bold leading-none text-muted-foreground">
          $
        </span>
        <span className="h-[5px] w-14 rounded-full bg-foreground/10" />
      </span>
    </div>
  )
}

// Automate workspace setup: a compact command bar with the setup run completed.
export function SetupScriptVisual(): JSX.Element {
  return (
    <div
      aria-hidden
      className="flex w-[132px] shrink-0 flex-col gap-2 rounded-[10px] border-[1.5px] border-border bg-card p-2.5 shadow-[0_6px_16px_rgba(0,0,0,0.12)]"
    >
      <span className="flex items-center gap-1.5">
        <Terminal className="size-[14px] shrink-0 text-muted-foreground" />
        <span className="font-mono text-[11px] font-bold leading-none text-muted-foreground">
          $
        </span>
        <span className="h-[5px] flex-1 rounded-full bg-foreground/10" />
      </span>
      <CheckLine className="w-4/5" />
    </div>
  )
}

function CapabilityTile(props: { icon: ReactNode }): JSX.Element {
  return (
    <span className="flex size-[34px] items-center justify-center rounded-[9px] border-[1.5px] border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
      {props.icon}
    </span>
  )
}
