import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  activateBrowser: vi.fn(),
  activateEditor: vi.fn(),
  activateTerminal: vi.fn(),
  closeAllEditorTabsInGroup: vi.fn(),
  closeGroup: vi.fn(),
  closeItem: vi.fn(),
  closeOthers: vi.fn(),
  closeToRight: vi.fn(),
  createSplitGroup: vi.fn(),
  duplicateBrowserTab: vi.fn(),
  focusGroup: vi.fn(),
  newBrowserTab: vi.fn(),
  newFileTab: vi.fn(),
  newTerminalTab: vi.fn(),
  newTerminalWithShell: vi.fn(),
  pinFile: vi.fn(),
  setTabColor: vi.fn(),
  setTabCustomTitle: vi.fn(),
  toggleTerminalPaneExpand: vi.fn()
}))

const modelBox = vi.hoisted(() => ({
  model: null as ReturnType<typeof makeModel> | null
}))

const storeBox = vi.hoisted(() => ({
  state: {
    rightSidebarOpen: true,
    sidebarOpen: true
  }
}))

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react') // eslint-disable-line @typescript-eslint/consistent-type-imports -- vi.importActual requires inline import()
  return {
    ...actual,
    useMemo: (factory: () => unknown) => factory()
  }
})

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: vi.fn() })
}))

vi.mock('../../store', () => ({
  useAppStore: (selector: (state: typeof storeBox.state) => unknown) => selector(storeBox.state)
}))

vi.mock('./useTabGroupWorkspaceModel', () => ({
  useTabGroupWorkspaceModel: () => {
    if (!modelBox.model) {
      throw new Error('model was not initialized')
    }
    return modelBox.model
  }
}))

vi.mock('../tab-bar/TabBar', () => ({
  default: function TabBar() {
    return null
  }
}))

vi.mock('../tab-bar/TabBarQuickCommandsButton', () => ({
  TabBarQuickCommandsButton: function TabBarQuickCommandsButton() {
    return null
  }
}))

vi.mock('../terminal/terminal-tab-actions', () => ({
  toggleTerminalPaneExpand: mocks.toggleTerminalPaneExpand
}))

vi.mock('./TabGroupDropOverlay', () => ({
  default: function TabGroupDropOverlay() {
    return null
  }
}))

type ComponentProps = {
  children?: unknown
  [key: string]: unknown
}

type ReactElementLike = {
  type: unknown
  props: ComponentProps
}

function makeModel({
  canExpand = true,
  expanded = false
}: {
  canExpand?: boolean
  expanded?: boolean
} = {}) {
  const terminalTab = {
    id: 'terminal-1',
    unifiedTabId: 'unified-terminal-1',
    ptyId: 'pty-1',
    worktreeId: 'wt-1',
    title: 'Terminal 1',
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
  const activeTab = {
    id: 'unified-terminal-1',
    entityId: 'terminal-1',
    groupId: 'group-1',
    worktreeId: 'wt-1',
    contentType: 'terminal' as const,
    label: 'Terminal 1',
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
  return {
    group: {
      id: 'group-1',
      worktreeId: 'wt-1',
      activeTabId: activeTab.id,
      tabOrder: [activeTab.id]
    },
    activeTab,
    browserItems: [],
    editorItems: [],
    terminalTabs: [terminalTab],
    tabBarOrder: [terminalTab.id],
    groupTabs: [activeTab],
    expandedPaneByTabId: expanded ? { 'terminal-1': true } : {},
    canExpandPaneByTabId: canExpand ? { 'terminal-1': true } : {},
    commands: {
      activateBrowser: mocks.activateBrowser,
      activateEditor: mocks.activateEditor,
      activateTerminal: mocks.activateTerminal,
      closeAllEditorTabsInGroup: mocks.closeAllEditorTabsInGroup,
      closeGroup: mocks.closeGroup,
      closeItem: mocks.closeItem,
      closeOthers: mocks.closeOthers,
      closeToRight: mocks.closeToRight,
      createSplitGroup: mocks.createSplitGroup,
      duplicateBrowserTab: mocks.duplicateBrowserTab,
      focusGroup: mocks.focusGroup,
      newBrowserTab: mocks.newBrowserTab,
      newFileTab: mocks.newFileTab,
      newTerminalTab: mocks.newTerminalTab,
      newTerminalWithShell: mocks.newTerminalWithShell,
      pinFile: mocks.pinFile,
      setTabColor: mocks.setTabColor,
      setTabCustomTitle: mocks.setTabCustomTitle
    }
  }
}

function visit(node: unknown, cb: (element: ReactElementLike) => void): void {
  if (node == null || typeof node === 'string' || typeof node === 'number') {
    return
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      visit(child, cb)
    }
    return
  }
  if (typeof node !== 'object' || !('props' in node)) {
    return
  }
  const element = node as ReactElementLike
  cb(element)
  visit(element.props.children, cb)
}

function findButtonByLabel(node: unknown, label: string): ReactElementLike | null {
  let found: ReactElementLike | null = null
  visit(node, (element) => {
    if (element.type === 'button' && element.props['aria-label'] === label) {
      found = element
    }
  })
  return found
}

function findChildByTypeName(node: unknown, typeName: string): ReactElementLike | null {
  let found: ReactElementLike | null = null
  visit(node, (element) => {
    const type = element.type as { name?: string } | string | undefined
    const name = typeof type === 'string' ? type : type?.name
    if (name === typeName) {
      found = element
    }
  })
  return found
}

async function renderPanel(): Promise<unknown> {
  const tabGroupPanelModule = await import('./TabGroupPanel')
  return tabGroupPanelModule.default({
    groupId: 'group-1',
    worktreeId: 'wt-1',
    isFocused: true,
    hasSplitGroups: true,
    touchesRightEdge: false,
    touchesLeftEdge: false,
    reserveClosedExplorerToggleSpace: false,
    reserveCollapsedSidebarHeaderSpace: false
  })
}

describe('TabGroupPanel pane expand state affordance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    modelBox.model = makeModel()
  })

  it('renders a normal-state expand affordance for expandable terminal panes', async () => {
    const element = await renderPanel()
    const button = findButtonByLabel(element, 'Expand pane')
    expect(button).not.toBeNull()
    expect(button?.props['aria-pressed']).toBe(false)
    expect(button?.props['data-pane-expand-state']).toBe('normal')
  })

  it('renders a highlighted collapse affordance when the pane is expanded', async () => {
    modelBox.model = makeModel({ expanded: true })
    const element = await renderPanel()
    const button = findButtonByLabel(element, 'Collapse pane')
    expect(button).not.toBeNull()
    expect(button?.props['aria-pressed']).toBe(true)
    expect(button?.props['data-pane-expand-state']).toBe('expanded')
    expect(button?.props.className).toContain('bg-accent')
  })

  it('dispatches the terminal-pane expand toggle from header and tab-bar controls', async () => {
    const element = await renderPanel()
    const stopPropagation = vi.fn()
    const button = findButtonByLabel(element, 'Expand pane')
    if (!button || typeof button.props.onClick !== 'function') {
      throw new Error('expand pane button not found')
    }
    button.props.onClick({ stopPropagation })

    const tabBar = findChildByTypeName(element, 'TabBar')
    if (!tabBar || typeof tabBar.props.onTogglePaneExpand !== 'function') {
      throw new Error('tab bar expand handler not found')
    }
    tabBar.props.onTogglePaneExpand('terminal-1')

    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(mocks.toggleTerminalPaneExpand).toHaveBeenNthCalledWith(1, 'terminal-1')
    expect(mocks.toggleTerminalPaneExpand).toHaveBeenNthCalledWith(2, 'terminal-1')
  })
})
