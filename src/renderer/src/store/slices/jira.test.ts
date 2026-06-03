import { beforeEach, describe, expect, it, vi } from 'vitest'
import { create } from 'zustand'
import type { AppState } from '../types'
import type { JiraConnectionStatus, JiraIssue, JiraViewer } from '../../../../shared/types'
import { createJiraSlice } from './jira'

const jiraStatus = vi.fn()
const jiraConnect = vi.fn()
const jiraDisconnect = vi.fn()
const jiraGetIssue = vi.fn()
const jiraListIssues = vi.fn()
const jiraSearchIssues = vi.fn()
const jiraSelectSite = vi.fn()
const jiraTestConnection = vi.fn()

vi.mock('@/runtime/runtime-jira-client', () => ({
  jiraAddIssueComment: vi.fn(),
  jiraConnect: (...args: unknown[]) => jiraConnect(...args),
  jiraCreateIssue: vi.fn(),
  jiraDisconnect: (...args: unknown[]) => jiraDisconnect(...args),
  jiraGetIssue: (...args: unknown[]) => jiraGetIssue(...args),
  jiraIssueComments: vi.fn(),
  jiraListCreateFields: vi.fn(),
  jiraListIssueTypes: vi.fn(),
  jiraListIssues: (...args: unknown[]) => jiraListIssues(...args),
  jiraListPriorities: vi.fn(),
  jiraListProjects: vi.fn(),
  jiraSearchIssues: (...args: unknown[]) => jiraSearchIssues(...args),
  jiraSelectSite: (...args: unknown[]) => jiraSelectSite(...args),
  jiraStatus: (...args: unknown[]) => jiraStatus(...args),
  jiraTestConnection: (...args: unknown[]) => jiraTestConnection(...args),
  jiraUpdateIssue: vi.fn()
}))

function createTestStore() {
  return create<AppState>()(
    (...a) =>
      ({
        settings: null,
        ...createJiraSlice(...a)
      }) as AppState
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function status(email: string): JiraConnectionStatus {
  return { connected: true, viewer: { email } as JiraViewer }
}

function issue(key: string): JiraIssue {
  return {
    id: key,
    key,
    title: key,
    url: `https://example.atlassian.net/browse/${key}`,
    project: { id: 'project-1', key: 'ORC', name: 'Orca' },
    issueType: { id: 'type-1', name: 'Task' },
    status: { id: 'status-1', name: 'Todo', categoryKey: 'new', categoryName: 'To Do' },
    labels: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('createJiraSlice runtime context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ignores stale status responses after the active runtime changes', async () => {
    const store = createTestStore()
    const localStatus = deferred<JiraConnectionStatus>()
    const remoteStatus = deferred<JiraConnectionStatus>()
    jiraStatus.mockReturnValueOnce(localStatus.promise).mockReturnValueOnce(remoteStatus.promise)

    const localRequest = store.getState().checkJiraConnection()
    store.setState({ settings: { activeRuntimeEnvironmentId: 'runtime-1' } as never })
    const remoteRequest = store.getState().checkJiraConnection()

    remoteStatus.resolve(status('remote@example.com'))
    await remoteRequest
    expect(store.getState().jiraStatus.viewer?.email).toBe('remote@example.com')
    expect(store.getState().jiraStatusContextKey).toBe('runtime:runtime-1#0')

    localStatus.resolve(status('local@example.com'))
    await localRequest
    expect(store.getState().jiraStatus.viewer?.email).toBe('remote@example.com')
    expect(store.getState().jiraStatusContextKey).toBe('runtime:runtime-1#0')
  })

  it('ignores stale issue cache writes after the active runtime changes', async () => {
    const store = createTestStore()
    const localIssue = deferred<JiraIssue | null>()
    const remoteIssue = deferred<JiraIssue | null>()
    jiraGetIssue.mockReturnValueOnce(localIssue.promise).mockReturnValueOnce(remoteIssue.promise)

    const localRequest = store.getState().fetchJiraIssue('ORC-1')
    store.setState({ settings: { activeRuntimeEnvironmentId: 'runtime-1' } as never })
    const remoteRequest = store.getState().fetchJiraIssue('ORC-1')

    remoteIssue.resolve({ ...issue('ORC-1'), title: 'Remote issue' })
    await remoteRequest
    expect(store.getState().jiraIssueCache['selected::ORC-1']?.data?.title).toBe('Remote issue')

    localIssue.resolve({ ...issue('ORC-1'), title: 'Local issue' })
    await localRequest
    expect(store.getState().jiraIssueCache['selected::ORC-1']?.data?.title).toBe('Remote issue')
  })

  it('returns a failed Jira connect result when the active runtime changes before completion', async () => {
    const store = createTestStore()
    const connectResult = deferred<{ ok: true; viewer: JiraViewer }>()
    jiraConnect.mockReturnValueOnce(connectResult.promise)

    const request = store.getState().connectJira({
      siteUrl: 'https://example.atlassian.net',
      email: 'local@example.com',
      apiToken: 'token'
    })
    store.setState({ settings: { activeRuntimeEnvironmentId: 'runtime-1' } as never })

    connectResult.resolve({ ok: true, viewer: { email: 'local@example.com' } as JiraViewer })
    await expect(request).resolves.toEqual({
      ok: false,
      error: 'Jira connection was superseded by a newer request.'
    })
    expect(store.getState().jiraStatus.connected).toBe(false)
    expect(store.getState().jiraStatusContextKey).toBeNull()
  })

  it('does not run a stale test follow-up status check after the active runtime changes', async () => {
    const store = createTestStore()
    const testResult = deferred<{ ok: true; viewer: JiraViewer }>()
    jiraTestConnection.mockReturnValueOnce(testResult.promise)

    const request = store.getState().testJiraConnection()
    store.setState({ settings: { activeRuntimeEnvironmentId: 'runtime-1' } as never })

    testResult.resolve({ ok: true, viewer: { email: 'local@example.com' } as JiraViewer })
    await request
    expect(jiraStatus).not.toHaveBeenCalled()
  })

  it('does not clear or refresh stale disconnect results after the active runtime changes', async () => {
    const store = createTestStore()
    const disconnectResult = deferred<void>()
    jiraDisconnect.mockReturnValueOnce(disconnectResult.promise)

    const request = store.getState().disconnectJira()
    store.setState({ settings: { activeRuntimeEnvironmentId: 'runtime-1' } as never })

    disconnectResult.resolve()
    await request
    expect(jiraStatus).not.toHaveBeenCalled()
  })
})
