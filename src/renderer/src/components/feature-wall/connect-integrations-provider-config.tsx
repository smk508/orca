import { Github, Gitlab } from 'lucide-react'

export type CliAuthProviderId = 'github' | 'gitlab'

export type CliProviderConfig = {
  statusKey: 'gh' | 'glab'
  icon: React.ReactNode
  name: string
  copy: string
  cliName: string
  installUrl: string
  installLabel: string
  installCopy: string
  connectedCopy: string
  command: string
}

export const CLI_PROVIDERS: Record<CliAuthProviderId, CliProviderConfig> = {
  github: {
    statusKey: 'gh',
    icon: <Github className="size-5" />,
    name: 'GitHub',
    copy: 'Pull requests, issues, and checks via the gh CLI.',
    cliName: 'gh',
    installUrl: 'https://cli.github.com',
    installLabel: 'Install gh',
    installCopy: 'Install the GitHub CLI to start work from issues and pull requests.',
    connectedCopy: 'Authenticated through the gh CLI. Orca reuses your existing login.',
    command: 'gh auth login'
  },
  gitlab: {
    statusKey: 'glab',
    icon: <Gitlab className="size-5" />,
    name: 'GitLab',
    copy: 'Merge requests, issues, todos, and pipelines via the glab CLI.',
    cliName: 'glab',
    installUrl: 'https://gitlab.com/gitlab-org/cli#installation',
    installLabel: 'Install glab',
    installCopy: 'Install the GitLab CLI to enable merge requests, issues, and pipelines.',
    connectedCopy: 'Authenticated through the glab CLI.',
    command: 'glab auth login'
  }
}
