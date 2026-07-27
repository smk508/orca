import { describe, expect, it } from 'vitest'

import { createKeyedSendSequencer } from './terminal-hardware-key-send-sequencer'

// Resolves after `ms`, letting a test make an earlier-enqueued send finish later.
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('createKeyedSendSequencer', () => {
  it('resolves same-key sends in enqueue order even when the slower one is enqueued first', async () => {
    const completedOrder: number[] = []
    const enqueue = createKeyedSendSequencer<number>(async (_key, value) => {
      await delay(value === 1 ? 20 : 0)
      completedOrder.push(value)
    })

    enqueue('term-a', 1)
    enqueue('term-a', 2)
    enqueue('term-a', 3)

    await delay(40)
    expect(completedOrder).toEqual([1, 2, 3])
  })

  it('does not block sends for a different key', async () => {
    const completedOrder: string[] = []
    const enqueue = createKeyedSendSequencer<string>(async (key, value) => {
      await delay(key === 'slow' ? 20 : 0)
      completedOrder.push(`${key}:${value}`)
    })

    enqueue('slow', 'a')
    enqueue('fast', 'b')

    await delay(5)
    expect(completedOrder).toEqual(['fast:b'])

    await delay(20)
    expect(completedOrder).toEqual(['fast:b', 'slow:a'])
  })

  it('continues sending subsequent keys after an earlier send rejects', async () => {
    const completedOrder: number[] = []
    const enqueue = createKeyedSendSequencer<number>(async (_key, value) => {
      if (value === 1) {
        throw new Error('transient failure')
      }
      completedOrder.push(value)
    })

    enqueue('term-a', 1)
    enqueue('term-a', 2)

    await delay(10)
    expect(completedOrder).toEqual([2])
  })
})
