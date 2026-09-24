import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const workerMock = vi.hoisted(() => {
  const instances: MockWorker[] = []

  class MockWorker extends EventTarget {
    postMessage = vi.fn()
    terminate = vi.fn()

    constructor() {
      super()
      instances.push(this)
    }
  }

  return {
    MockWorker,
    instances
  }
})

vi.mock('./bgRemove.worker?worker', () => ({
  default: workerMock.MockWorker
}))

import { bgRemoveEngine, disposeBgRemoveWorker } from './bgRemoveEngine'

const file = new File(['image'], 'image.png', { type: 'image/png' })

beforeEach(() => {
  workerMock.instances.length = 0
  disposeBgRemoveWorker('test cleanup')
})

afterEach(() => {
  disposeBgRemoveWorker('test cleanup')
})

describe('bgRemoveEngine worker lifecycle', () => {
  it('abort terminates the shared worker and rejects all active requests', async () => {
    const firstController = new AbortController()
    const secondController = new AbortController()
    const first = bgRemoveEngine(file, { signal: firstController.signal })
    const second = bgRemoveEngine(file, { signal: secondController.signal })

    firstController.abort()

    await expect(first).rejects.toThrow('AbortError')
    await expect(second).rejects.toThrow('AbortError')
    expect(workerMock.instances).toHaveLength(1)
    expect(workerMock.instances[0]!.terminate).toHaveBeenCalledOnce()
  })

  it('creates a fresh worker after cancellation', async () => {
    const controller = new AbortController()
    const first = bgRemoveEngine(file, { signal: controller.signal })
    controller.abort()
    await expect(first).rejects.toThrow('AbortError')

    const second = bgRemoveEngine(file, {})
    expect(workerMock.instances).toHaveLength(2)

    disposeBgRemoveWorker('test cleanup')
    await expect(second).rejects.toThrow('test cleanup')
  })
})
