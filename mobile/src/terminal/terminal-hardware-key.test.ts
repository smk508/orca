import { describe, expect, it } from 'vitest'

import { nativeKeyEventToBytes, nativeKeyEventToShortcut } from './terminal-hardware-key'

type Mods = { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean }

// iOS-shaped event: key id is empty, resolved from the HID `keyCode`.
function ios(keyCode: number, characters: string, mods: Mods = {}) {
  return {
    key: '',
    keyCode,
    characters,
    charactersIgnoringModifiers: characters,
    ctrlKey: !!mods.ctrl,
    altKey: !!mods.alt,
    shiftKey: !!mods.shift,
    metaKey: !!mods.meta
  }
}

// Android-shaped event: key id pre-resolved natively, keyCode unused.
function android(key: string, mods: Mods = {}) {
  return {
    key,
    keyCode: 0,
    characters: '',
    charactersIgnoringModifiers: '',
    ctrlKey: !!mods.ctrl,
    altKey: !!mods.alt,
    shiftKey: !!mods.shift,
    metaKey: !!mods.meta
  }
}

describe('nativeKeyEventToBytes (iOS HID keyCodes)', () => {
  it.each([
    ['Ctrl+C interrupt', ios(0x06, 'c', { ctrl: true }), '\x03'],
    ['plain letter', ios(0x04, 'a'), 'a'],
    ['Ctrl+A start-of-line', ios(0x04, 'a', { ctrl: true }), '\x01'],
    ['Alt+b word-back', ios(0x05, 'b', { alt: true }), '\x1bb'],
    ['arrow up', ios(0x52, ''), '\x1b[A'],
    ['arrow down', ios(0x51, ''), '\x1b[B'],
    ['arrow left', ios(0x50, ''), '\x1b[D'],
    ['arrow right', ios(0x4f, ''), '\x1b[C'],
    ['Ctrl+ArrowUp', ios(0x52, '', { ctrl: true }), '\x1b[1;5A'],
    ['escape', ios(0x29, ''), '\x1b'],
    ['tab', ios(0x2b, ''), '\t'],
    ['shift+tab reverse', ios(0x2b, '', { shift: true }), '\x1b[Z'],
    ['backspace', ios(0x2a, ''), '\x7f'],
    ['enter', ios(0x28, ''), '\r'],
    ['F5', ios(0x3e, ''), '\x1b[15~'],
    ['page up', ios(0x4b, ''), '\x1b[5~'],
    ['home', ios(0x4a, ''), '\x1b[H']
  ])('encodes %s', (_name, event, expected) => {
    expect(nativeKeyEventToBytes(event)).toBe(expected)
  })

  it('returns null for a bare modifier with no resolvable key', () => {
    expect(nativeKeyEventToBytes(ios(0xe0, '', { ctrl: true }))).toBeNull()
  })
})

describe('nativeKeyEventToBytes (Android pre-resolved key)', () => {
  it.each([
    ['Ctrl+C', android('c', { ctrl: true }), '\x03'],
    ['arrow up', android('arrowUp'), '\x1b[A'],
    ['escape', android('escape'), '\x1b'],
    ['plain letter', android('a'), 'a']
  ])('encodes %s', (_name, event, expected) => {
    expect(nativeKeyEventToBytes(event)).toBe(expected)
  })
})

describe('nativeKeyEventToShortcut', () => {
  it('collects modifiers in ctrl/alt/shift order', () => {
    const binding = nativeKeyEventToShortcut(
      ios(0x04, 'a', { ctrl: true, alt: true, shift: true })
    )
    expect(binding).toEqual({ key: 'a', modifiers: ['ctrl', 'alt', 'shift'] })
  })

  it('prefers a natively-resolved Android key id over keyCode', () => {
    expect(nativeKeyEventToShortcut(android('arrowLeft'))).toEqual({
      key: 'arrowLeft',
      modifiers: []
    })
  })
})
