import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connect, type Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { DaemonServer } from './daemon-server'
import { encodeNdjson } from './ndjson'
import { PROTOCOL_VERSION, type DaemonRequest } from './types'
import type { SubprocessHandle } from './session'
import { getDaemonSocketPath } from './daemon-spawner'

// Why this file exists: sessions outlive the clients that watch them — that is the
// daemon's entire purpose. The session→client stream route was only ever written by
// createOrAttach and only ever erased on session exit, so a client transport that
// closed left its sessions pointed at a clientId that no longer resolved. The PTY
// reader kept enqueueing to that dead id and DaemonStreamDataBatcher.enqueue dropped
// every chunk at its `getClient()` guard: output read off the PTY, discarded, no
// error and no log line, permanently, until the session exited.

function createMockSubprocess(): SubprocessHandle & {
  _simulateData: (data: string) => void
} {
  let onDataCb: ((data: string) => void) | null = null
  let onExitCb: ((code: number) => void) | null = null
  return {
    pid: 4242,
    getForegroundProcess: vi.fn(() => null),
    confirmForegroundProcess: vi.fn(async () => 'zsh'),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(() => setTimeout(() => onExitCb?.(0), 5)),
    forceKill: vi.fn(() => onExitCb?.(137)),
    signal: vi.fn(),
    onData(cb) {
      onDataCb = cb
    },
    onExit(cb) {
      onExitCb = cb
    },
    dispose: vi.fn(),
    _simulateData(data: string) {
      onDataCb?.(data)
    }
  }
}

type DaemonServerPrivate = {
  clients: Map<string, { clientId: string; controlSocket: Socket; streamSocket: Socket | null }>
  streamClientIdBySessionId: Map<string, string>
  routeRequest(clientId: string, request: DaemonRequest): Promise<unknown>
}

describe('daemon session stream routing lifecycle', () => {
  let dir: string
  let socketPath: string
  let tokenPath: string
  let server: DaemonServer
  let subprocess: ReturnType<typeof createMockSubprocess>
  const openSockets: Socket[] = []

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'daemon-routing-test-'))
    socketPath = getDaemonSocketPath(dir)
    tokenPath = join(dir, 'test.token')
    server = new DaemonServer({
      socketPath,
      tokenPath,
      spawnSubprocess: () => {
        subprocess = createMockSubprocess()
        return subprocess
      }
    })
    await server.start()
  })

  afterEach(async () => {
    for (const socket of openSockets.splice(0)) {
      socket.destroy()
    }
    await server?.shutdown()
    rmSync(dir, { recursive: true, force: true })
  })

  async function connectHello(role: 'control' | 'stream', clientId: string): Promise<Socket> {
    const socket = connect(socketPath)
    openSockets.push(socket)
    await new Promise<void>((resolve) => socket.once('connect', resolve))
    socket.write(
      encodeNdjson({
        type: 'hello',
        version: PROTOCOL_VERSION,
        token: readFileSync(tokenPath, 'utf-8').trim(),
        clientId,
        role
      })
    )
    await new Promise<void>((resolve, reject) => {
      const onData = (data: Buffer): void => {
        socket.off('data', onData)
        const parsed = JSON.parse(data.toString().trim()) as { ok?: boolean; error?: string }
        if (parsed.ok) {
          resolve()
          return
        }
        reject(new Error(parsed.error ?? 'hello rejected'))
      }
      socket.on('data', onData)
    })
    return socket
  }

  async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
    const startedAt = Date.now()
    while (!predicate() && Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }

  it('drops the session stream route when the attaching client disconnects', async () => {
    const daemon = server as unknown as DaemonServerPrivate
    const control = await connectHello('control', 'client-a')
    await connectHello('stream', 'client-a')

    await daemon.routeRequest('client-a', {
      id: 'req-1',
      type: 'createOrAttach',
      payload: { sessionId: 'session-1', cols: 80, rows: 24 }
    })
    expect(daemon.streamClientIdBySessionId.get('session-1')).toBe('client-a')

    // The client's transport dies while the PTY stays alive — a network blip, a
    // runtime restart, a laptop sleeping. The session must not stay bound to it.
    control.destroy()
    await waitFor(() => !daemon.clients.has('client-a'))
    expect(daemon.clients.has('client-a')).toBe(false)

    expect(daemon.streamClientIdBySessionId.has('session-1')).toBe(false)
  })

  it('records a session whose output has nowhere to go instead of dropping it silently', async () => {
    const daemon = server as unknown as DaemonServerPrivate
    const logged: { event: string; payload: unknown }[] = []
    const log = (server as unknown as { log: { log: (event: string, payload: unknown) => void } })
      .log
    const originalLog = log.log.bind(log)
    log.log = (event: string, payload: unknown): void => {
      logged.push({ event, payload })
      originalLog(event, payload)
    }

    const control = await connectHello('control', 'client-a')
    await connectHello('stream', 'client-a')
    await daemon.routeRequest('client-a', {
      id: 'req-1',
      type: 'createOrAttach',
      payload: { sessionId: 'session-1', cols: 80, rows: 24 }
    })

    control.destroy()
    await waitFor(() => !daemon.clients.has('client-a'))

    subprocess._simulateData('output-nobody-can-receive')
    subprocess._simulateData('and-more')

    const unrouted = logged.filter((entry) => entry.event === 'session-stream-unrouted')
    expect(unrouted).toHaveLength(1)
    expect(unrouted[0]?.payload).toMatchObject({ sessionId: 'session-1' })
  })

  it('routes output to a replacement client after the original disconnects', async () => {
    const daemon = server as unknown as DaemonServerPrivate
    const control = await connectHello('control', 'client-a')
    await connectHello('stream', 'client-a')

    await daemon.routeRequest('client-a', {
      id: 'req-1',
      type: 'createOrAttach',
      payload: { sessionId: 'session-1', cols: 80, rows: 24 }
    })

    control.destroy()
    await waitFor(() => !daemon.clients.has('client-a'))

    await connectHello('control', 'client-b')
    const streamB = await connectHello('stream', 'client-b')
    const received: string[] = []
    streamB.on('data', (chunk: Buffer) => received.push(chunk.toString()))

    await daemon.routeRequest('client-b', {
      id: 'req-2',
      type: 'createOrAttach',
      payload: { sessionId: 'session-1', cols: 80, rows: 24 }
    })
    expect(daemon.streamClientIdBySessionId.get('session-1')).toBe('client-b')

    subprocess._simulateData('after-reattach')
    await waitFor(() => received.join('').includes('after-reattach'))
    expect(received.join('')).toContain('after-reattach')
  })
})
