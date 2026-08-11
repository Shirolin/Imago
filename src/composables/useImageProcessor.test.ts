import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useImageStore } from '../stores/imageStore'
import { useImageProcessor } from './useImageProcessor'

/**
 * useImageProcessor 回归测试（processSingle isProcessing 置位/复位、队列级 AbortController
 * 中止整批、单任务 abort 回 idle、进度聚合 0-100 不越界）
 *
 * Mock 策略：store 用真实 pinia + Image 桩（addImages 需要 naturalWidth）；processor 用
 * deferred mock——同步收集调用（file/options），由测试决定 resolve/reject，signal 监听 abort
 * 事件立即 reject('AbortError')；不依赖真实定时器。
 */

type MockFn = Mock

interface ProcessorEntry {
  file: File
  opts: {
    signal?: AbortSignal
    onProgress?: (p: number) => void
    [key: string]: unknown
  }
  resolve: (value: unknown) => void
  reject: (err: Error) => void
}

function deferredProcessor() {
  const entries: ProcessorEntry[] = []
  const processor = vi.fn((file: File, opts: ProcessorEntry['opts']) => {
    return new Promise((resolve, reject) => {
      if (opts.signal?.aborted) {
        reject(new Error('AbortError'))
        return
      }
      opts.signal?.addEventListener('abort', () => reject(new Error('AbortError')))
      entries.push({ file, opts, resolve, reject })
    })
  }) as unknown as MockFn
  return { processor, entries }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('mock-url')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 100
      naturalHeight = 100
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_v: string) {
        this.onload?.()
      }
    }
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function addItems(...names: string[]) {
  const store = useImageStore()
  await store.addImages(names.map((n) => new File(['x'], n, { type: 'image/png' })))
  return store
}

describe('processSingle', () => {
  it('成功：状态 done、进度 1、isProcessing 置位后复位', async () => {
    const store = await addItems('a.png')
    const { processor, entries } = deferredProcessor()
    const { processSingle, isProcessing, progress } = useImageProcessor(processor)
    const id = store.images[0]!.id

    const promise = processSingle(id, {})
    expect(entries).toHaveLength(1)
    expect(isProcessing.value).toBe(true)
    expect(store.images[0]!.status).toBe('processing')

    entries[0]!.resolve({ size: 42, blob: new Blob(['x']) })
    const result = await promise
    expect(result).toEqual({ size: 42, blob: expect.any(Blob) })
    expect(store.images[0]!.status).toBe('done')
    expect(store.images[0]!.progress).toBe(1)
    expect(isProcessing.value).toBe(false)
    expect(progress.value).toBe(0)
    expect(processor).toHaveBeenCalledWith(
      store.images[0]!.file,
      expect.objectContaining({ jobId: id })
    )
  })

  it('失败：状态 error、记录异常信息、isProcessing 在 finally 复位', async () => {
    const store = await addItems('a.png')
    const { processor, entries } = deferredProcessor()
    const { processSingle, isProcessing } = useImageProcessor(processor)
    const id = store.images[0]!.id

    const promise = processSingle(id, {})
    expect(entries).toHaveLength(1)
    entries[0]!.reject(new Error('boom'))
    await promise
    expect(store.images[0]!.status).toBe('error')
    expect(store.images[0]!.error).toBe('boom')
    expect(isProcessing.value).toBe(false)
  })

  it('abortProcessing 中止单任务：状态回 idle', async () => {
    const store = await addItems('a.png')
    const { processor, entries } = deferredProcessor()
    const { processSingle, abortProcessing, isProcessing } = useImageProcessor(processor)
    const id = store.images[0]!.id

    const promise = processSingle(id, {})
    expect(entries).toHaveLength(1)
    abortProcessing()
    await promise
    expect(store.images[0]!.status).toBe('idle')
    expect(store.images[0]!.abortController).toBeUndefined()
    expect(isProcessing.value).toBe(false)
  })

  it('外部 signal 中止单任务：状态回 idle', async () => {
    const store = await addItems('a.png')
    const { processor, entries } = deferredProcessor()
    const { processSingle, isProcessing } = useImageProcessor(processor)
    const controller = new AbortController()
    const id = store.images[0]!.id

    const promise = processSingle(id, { signal: controller.signal })
    expect(entries).toHaveLength(1)
    controller.abort()
    await promise
    expect(store.images[0]!.status).toBe('idle')
    expect(isProcessing.value).toBe(false)
  })

  it('未知 id：返回 undefined 且不调用 processor', async () => {
    const { processor } = deferredProcessor()
    const { processSingle, isProcessing } = useImageProcessor(processor)
    const result = await processSingle('nope', {})
    expect(result).toBeUndefined()
    expect(processor).not.toHaveBeenCalled()
    expect(isProcessing.value).toBe(false)
  })

  it('manageProcessing=false：不置位 isProcessing（队列场景）', async () => {
    const store = await addItems('a.png')
    const { processor, entries } = deferredProcessor()
    const { processSingle, isProcessing } = useImageProcessor(processor)
    const id = store.images[0]!.id

    const promise = processSingle(id, {}, undefined, false)
    expect(entries).toHaveLength(1)
    expect(isProcessing.value).toBe(false)
    entries[0]!.resolve({ size: 1 })
    await promise
    expect(isProcessing.value).toBe(false)
  })

  it('onProgress 同步写入全局进度与条目进度', async () => {
    const store = await addItems('a.png')
    const { processor, entries } = deferredProcessor()
    const { processSingle, progress } = useImageProcessor(processor)
    const id = store.images[0]!.id

    const promise = processSingle(id, {})
    expect(entries).toHaveLength(1)
    entries[0]!.opts.onProgress!(0.4)
    expect(progress.value).toBe(0.4)
    expect(store.images[0]!.progress).toBe(0.4)
    entries[0]!.resolve({ size: 1 })
    await promise
  })
})

describe('processQueue（经 processAll 驱动） / processSelected', () => {
  it('队列成功：全部 done、onResult 逐个回调、最终复位', async () => {
    const store = await addItems('a.png', 'b.png')
    const { processor, entries } = deferredProcessor()
    const { processAll, isProcessing } = useImageProcessor(processor)
    const onResult = vi.fn()

    const promise = processAll({}, onResult)
    expect(entries).toHaveLength(2)
    expect(isProcessing.value).toBe(true)

    entries[0]!.resolve({ size: 1 })
    entries[1]!.resolve({ size: 2 })
    await promise
    expect(onResult).toHaveBeenCalledTimes(2)
    expect(store.images.every((i) => i.status === 'done')).toBe(true)
    expect(isProcessing.value).toBe(false)
  })

  it('队列进度聚合：0-100 且不越界', async () => {
    const store = await addItems('a.png', 'b.png')
    const { processor, entries } = deferredProcessor()
    const { processAll, progress } = useImageProcessor(processor)

    const promise = processAll({})
    expect(entries).toHaveLength(2)

    entries[0]!.opts.onProgress!(0.5)
    expect(progress.value).toBe(25) // 0.5/2 × 100
    entries[1]!.opts.onProgress!(1)
    expect(progress.value).toBe(75)
    entries[1]!.opts.onProgress!(2) // 超上限 → 钳制
    expect(progress.value).toBe(100)

    entries[0]!.resolve({ size: 1 })
    entries[1]!.resolve({ size: 1 })
    await promise
    expect(progress.value).toBe(0)
  })

  it('abortProcessing 中止整批：所有条目回 idle（而非只中止最后一个）', async () => {
    const store = await addItems('a.png', 'b.png', 'c.png')
    const { processor, entries } = deferredProcessor()
    const { processAll, abortProcessing, isProcessing } = useImageProcessor(processor)

    const promise = processAll({})
    expect(entries).toHaveLength(3)
    abortProcessing()
    await promise
    expect(store.images.every((i) => i.status === 'idle')).toBe(true)
    expect(isProcessing.value).toBe(false)
  })

  it('空列表：不启动处理', async () => {
    useImageStore() // 空 store，无待处理条目
    const { processor } = deferredProcessor()
    const { processAll, isProcessing } = useImageProcessor(processor)
    await processAll({})
    expect(processor).not.toHaveBeenCalled()
    expect(isProcessing.value).toBe(false)
  })

  it('processAll：只处理未完成条目', async () => {
    const store = await addItems('a.png', 'b.png')
    const processor = vi.fn(async () => ({ size: 1 }))
    const { processAll } = useImageProcessor(processor)
    store.updateImage(store.images[0]!.id, { status: 'done' })

    await processAll({})
    expect(processor).toHaveBeenCalledTimes(1)
    expect(processor).toHaveBeenCalledWith(store.images[1]!.file, expect.anything())
    expect(store.images[1]!.status).toBe('done')
  })

  it('processSelected：只处理选中条目', async () => {
    const store = await addItems('a.png', 'b.png')
    const processor = vi.fn(async () => ({ size: 1 }))
    const { processSelected } = useImageProcessor(processor)
    store.toggleSelection(store.images[0]!.id)

    await processSelected({})
    expect(processor).toHaveBeenCalledTimes(1)
    expect(processor).toHaveBeenCalledWith(store.images[0]!.file, expect.anything())
    expect(store.images[0]!.status).toBe('done')
  })
})

describe('processCombine', () => {
  it('传入文件列表并返回结果，isProcessing 复位', async () => {
    const store = await addItems('a.png', 'b.png')
    const processor = vi.fn(async () => ({ size: 99 }))
    const { processCombine, isProcessing } = useImageProcessor(processor)

    const promise = processCombine({ direction: 'vertical' })
    expect(isProcessing.value).toBe(true)
    const result = await promise
    expect(result).toEqual({ size: 99 })
    expect(processor).toHaveBeenCalledWith(
      store.images.map((i) => i.file),
      expect.objectContaining({ direction: 'vertical', signal: expect.any(AbortSignal) })
    )
    expect(isProcessing.value).toBe(false)
  })

  it('失败：抛错并复位 isProcessing', async () => {
    await addItems('a.png')
    const processor = vi.fn(async () => {
      throw new Error('combine failed')
    })
    const { processCombine, isProcessing } = useImageProcessor(processor)

    await expect(processCombine({ direction: 'vertical' })).rejects.toThrow('combine failed')
    expect(isProcessing.value).toBe(false)
  })
})
