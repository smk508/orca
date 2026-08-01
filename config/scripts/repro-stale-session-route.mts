/**
 * End-to-end reproduction for the stale session-route defect.
 *
 * Runs a real DaemonServer over a real unix socket, spawns a real PTY through
 * the same createPtySubprocess() the shipping daemon uses, then closes the
 * attaching client's transport the way a network blip or runtime restart does.
 *
 * The session keeps running. The question the harness answers is whether its
 * output still reaches anybody, and whether the daemon says anything when it
 * does not.
 *
 *   npx tsx config/scripts/repro-stale-session-route.mts
 *
 * Exit 0 = routing recovered and the outage was reported (fixed).
 * Exit 1 = output silently discarded (defect present).
 */
import { connect, type Socket } from 'node:net'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DaemonServer } from '../../src/main/daemon/daemon-server'
import { createPtySubprocess } from '../../src/main/daemon/pty-subprocess'
import { encodeNdjson } from '../../src/main/daemon/ndjson'
import { PROTOCOL_VERSION } from '../../src/main/daemon/types'

const SESSION_ID = 'repro-session'
const dir = mkdtempSync(join(tmpdir(), 'repro-stale-route-'))
const socketPath = join(dir, 'daemon.sock')
const tokenPath = join(dir, 'daemon.token')

const logLines: { event: string; payload: unknown }[] = []
const sockets: Socket[] = []

function step(n: number, text: string): void {
  console.log(`\n[${n}] ${text}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function hello(role: 'control' | 'stream', clientId: string): Promise<Socket> {
  const socket = connect(socketPath)
  sockets.push(socket)
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
    const onData = (buf: Buffer): void => {
      socket.off('data', onData)
      const parsed = JSON.parse(buf.toString().trim()) as { ok?: boolean; error?: string }
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

async function main(): Promise<number> {
  const server = new DaemonServer({
    socketPath,
    tokenPath,
    spawnSubprocess: (opts) => createPtySubprocess(opts)
  })
  await server.start()

  // Capture the daemon's own log so we can tell silence from a reported outage.
  const log = (server as unknown as { log: { log: (e: string, p: unknown) => void } }).log
  const originalLog = log.log.bind(log)
  log.log = (event: string, payload: unknown): void => {
    logLines.push({ event, payload })
    originalLog(event, payload)
  }

  const daemon = server as unknown as {
    clients: Map<string, unknown>
    streamClientIdBySessionId: Map<string, string>
    routeRequest(clientId: string, request: unknown): Promise<unknown>
  }

  step(1, 'client-a attaches a real PTY session (/bin/sh)')
  const controlA = await hello('control', 'client-a')
  await hello('stream', 'client-a')
  await daemon.routeRequest('client-a', {
    id: 'r1',
    type: 'createOrAttach',
    payload: { sessionId: SESSION_ID, cols: 80, rows: 24, command: '/bin/sh' }
  })
  console.log(`    route: ${SESSION_ID} -> ${daemon.streamClientIdBySessionId.get(SESSION_ID)}`)

  step(2, "client-a's transport closes (network blip / runtime restart)")
  controlA.destroy()
  for (let i = 0; i < 100 && daemon.clients.has('client-a'); i += 1) {
    await sleep(20)
  }
  console.log(`    client-a still registered: ${daemon.clients.has('client-a')}`)
  const orphanedRoute = daemon.streamClientIdBySessionId.get(SESSION_ID)
  console.log(`    route now: ${orphanedRoute ?? '(cleared)'}`)

  step(3, 'the PTY keeps producing while nothing is attached')
  await daemon
    .routeRequest('client-a', {
      id: 'r2',
      type: 'write',
      payload: { sessionId: SESSION_ID, data: 'echo still-running\n' }
    })
    .catch(() => undefined)
  await sleep(600)
  const unrouted = logLines.filter((l) => l.event === 'session-stream-unrouted')
  console.log(`    daemon reported the outage: ${unrouted.length > 0 ? 'YES' : 'NO (silent)'}`)

  step(4, 'client-b attaches the same session and listens')
  await hello('control', 'client-b')
  const streamB = await hello('stream', 'client-b')
  const seen: string[] = []
  streamB.on('data', (chunk: Buffer) => seen.push(chunk.toString()))
  await daemon.routeRequest('client-b', {
    id: 'r3',
    type: 'createOrAttach',
    payload: { sessionId: SESSION_ID, cols: 80, rows: 24 }
  })
  console.log(`    route: ${SESSION_ID} -> ${daemon.streamClientIdBySessionId.get(SESSION_ID)}`)

  step(5, 'drive the live shell and see whether client-b receives its output')
  await daemon.routeRequest('client-b', {
    id: 'r4',
    type: 'write',
    payload: { sessionId: SESSION_ID, data: 'echo MARKER-AFTER-REATTACH\n' }
  })
  for (let i = 0; i < 100 && !seen.join('').includes('MARKER-AFTER-REATTACH'); i += 1) {
    await sleep(50)
  }
  const delivered = seen.join('').includes('MARKER-AFTER-REATTACH')
  console.log(`    client-b received live output: ${delivered ? 'YES' : 'NO'}`)

  await server.shutdown()

  console.log(`\n${'='.repeat(64)}`)
  console.log(`route cleared on disconnect : ${orphanedRoute === undefined ? 'PASS' : 'FAIL'}`)
  console.log(`outage reported in log      : ${unrouted.length > 0 ? 'PASS' : 'FAIL'}`)
  console.log(`delivery restored on attach : ${delivered ? 'PASS' : 'FAIL'}`)
  console.log('='.repeat(64))

  return orphanedRoute === undefined && unrouted.length > 0 && delivered ? 0 : 1
}

main()
  .then((code) => {
    for (const socket of sockets) {
      socket.destroy()
    }
    rmSync(dir, { recursive: true, force: true })
    process.exit(code)
  })
  .catch((error) => {
    console.error(error)
    rmSync(dir, { recursive: true, force: true })
    process.exit(2)
  })
