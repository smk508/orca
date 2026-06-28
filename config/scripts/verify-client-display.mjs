#!/usr/bin/env node
// Verify-harness helper for client-owned display changes (theme / terminal
// render options). Automates the deterministic rungs of
// notes/client-display-verify-harness.md: rung-1 repo gates, and the rung-2
// iOS-simulator light/dark capture. Rung-3 (web) is browser-MCP driven and
// documented in the note, not scripted here.
//
// Usage:
//   node config/scripts/verify-client-display.mjs gates --label <ticket>
//   node config/scripts/verify-client-display.mjs sim-capture --label <ticket> [--device <udid|booted>]

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      args[a.slice(2)] = argv[++i]
    } else {
      args._.push(a)
    }
  }
  return args
}

function artifactDir(label) {
  if (!label) {
    console.error('error: --label <ticket> is required (e.g. --label che-1308)')
    process.exit(2)
  }
  const dir = join('.verify-orca', label)
  mkdirSync(dir, { recursive: true })
  return dir
}

// Rung 1 — run each gate to completion (don't abort on first failure) so the
// artifact captures the full picture, then summarize.
function runGates(label) {
  const dir = artifactDir(label)
  const gates = [
    { name: 'typecheck', cmd: 'pnpm', args: ['typecheck'] },
    { name: 'test', cmd: 'pnpm', args: ['test'] },
    { name: 'lint', cmd: 'pnpm', args: ['lint'] }
  ]
  const results = []
  for (const gate of gates) {
    process.stdout.write(`rung1: ${gate.name} … `)
    const out = spawnSync(gate.cmd, gate.args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const log = `$ ${gate.cmd} ${gate.args.join(' ')}\n\n${out.stdout || ''}\n${out.stderr || ''}`
    writeFileSync(join(dir, `rung1-${gate.name}.log`), log)
    const ok = out.status === 0
    results.push({ name: gate.name, ok, code: out.status })
    console.log(ok ? 'PASS' : `FAIL (exit ${out.status})`)
  }
  console.log(`\nrung1 logs → ${dir}/rung1-*.log`)
  const failed = results.filter((r) => !r.ok)
  process.exit(failed.length === 0 ? 0 : 1)
}

// Rung 2 — toggle simulator appearance and screenshot. Pure simctl: needs only
// Xcode CLI, no WebDriverAgent. macOS only (iOS simulator).
function simCapture(label, device) {
  if (process.platform !== 'darwin') {
    console.error('error: sim-capture is macOS only (iOS simulator)')
    process.exit(2)
  }
  const dir = artifactDir(label)
  const target = device || 'booted'
  for (const mode of ['light', 'dark']) {
    const ui = spawnSync('xcrun', ['simctl', 'ui', target, 'appearance', mode], {
      encoding: 'utf8'
    })
    if (ui.status !== 0) {
      console.error(
        `error: simctl ui appearance ${mode} failed — is a simulator booted?\n${ui.stderr}`
      )
      process.exit(1)
    }
    // Give the UI a moment to repaint before grabbing the frame.
    spawnSync('sleep', ['2'])
    const out = join(dir, `${label}-${mode}.png`)
    const shot = spawnSync('xcrun', ['simctl', 'io', target, 'screenshot', out], {
      encoding: 'utf8'
    })
    if (shot.status !== 0) {
      console.error(`error: simctl io screenshot (${mode}) failed\n${shot.stderr}`)
      process.exit(1)
    }
    console.log(`captured ${mode} → ${out}`)
  }
}

const args = parseArgs(process.argv.slice(2))
const command = args._[0]
switch (command) {
  case 'gates':
    runGates(args.label)
    break
  case 'sim-capture':
    simCapture(args.label, args.device)
    break
  default:
    console.error(
      'usage: verify-client-display.mjs <gates|sim-capture> --label <ticket> [--device <udid|booted>]'
    )
    process.exit(2)
}
