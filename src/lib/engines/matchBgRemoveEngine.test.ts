import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isAbortError } from './abort'

/**
 * matchBgRemoveEngine 的 worker 编排层。
 *
 * 此前零测试：worker 生命周期（超时 / abort / terminate）与
 * 像素转移全靠真实浏览器手测。而 matchDespill.test.ts 只覆盖了
 * 纯算法 processMatchPixels，管不到编排。
 *
 * 这里用可控的假 Worker 与假 canvas 夹具锁住：
 *  - abort 在解码阶段就该生效（此前完全没检查）
 *  - abort 后必须 terminate，且 reject 可被 isAbortError 认出
 *  - 超时兜底会 reject 而非永久挂起
 *  - settled 幂等：重复 abort / abort 后再 done 只结算一次
 *  - 像素以 Transferable 转移，worker 回传后写回 canvas
 */

class FakeWorker {
  static instances: FakeWorker[] = []
  terminated = false
  postMessageArgs: unknown[] = []
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: ((e: unknown) => void) | null = null

  constructor() {
    FakeWorker.instances.push(this)
  }

  postMessage(...args: unknown[]) {
    this.postMessageArgs = args
  }

  terminate() {
    this.terminated = true
  }

  emit(data: unknown) {
    this.onmessage?.({ data })
  }

  emitError(err: unknown) {
    this.onerror?.(err)
  }
}

/** 记录尺寸的假 canvas；drawImage/getImageData/toBlob 可控 */
function installFakeCanvas() {
  const created: Array<Record<string, unknown>> = []

  class FakeCtx {
    calls: string[] = []
    data: Uint8ClampedArray
    width: number
    height: number

    constructor(w: number, h: number) {
      this.width = w
      this.height = h
      // 4 像素：首像素当作采样到的背景色
      this.data = new Uint8ClampedArray([
        10, 20, 30, 255, 11, 21, 31, 255, 12, 22, 32, 255, 13, 23, 33, 255
      ])
    }

    drawImage() {
      this.calls.push('drawImage')
    }

    getImageData(_x: number, _y: number, w: number, h: number) {
      this.calls.push('getImageData')
      return { data: this.data, width: w, height: h }
    }

    putImageData() {
      this.calls.push('putImageData')
    }
  }

  vi.stubGlobal('document', {
    createElement: () => {
      const ctx = new FakeCtx(0, 0)
      const el = {
        width: 0,
        height: 0,
        getContext: () => ctx,
        toBlob: (cb: (b: Blob | null) => void, type?: string) => {
          cb(new Blob(['x'], { type: type ?? 'image/png' }))
        }
      }
      created.push(el as unknown as Record<string, unknown>)
      return el
    }
  })

  return created
}

/** 假 Image + FileReader，onload 挂到 microtask 后触发 */
function installFakeImage(width = 4, height = 4) {
  class FakeImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    width = width
    height = height
    naturalWidth = width
    naturalHeight = height
    set src(_v: string) {
      queueMicrotask(() => this.onload?.())
    }
  }
  vi.stubGlobal('Image', FakeImage)

  class FakeReader {
    result: string | ArrayBuffer | null = null
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    readAsDataURL() {
      this.result = 'data:image/png;base64,'
      queueMicrotask(() => this.onload?.())
    }
  }
  vi.stubGlobal('FileReader', FakeReader)

  // jsdom 不实现 ImageData（引擎用它写回 canvas）
  vi.stubGlobal(
    'ImageData',
    class FakeImageData {
      data: Uint8ClampedArray
      width: number
      height: number

      constructor(d: Uint8ClampedArray, w: number, h: number) {
        this.data = d
        this.width = w
        this.height = h
      }
    }
  )
}

const blobFile = () => new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })

beforeEach(() => {
  FakeWorker.instances = []
  vi.useFakeTimers()
  installFakeImage()
  installFakeCanvas()
  vi.stubGlobal('Worker', FakeWorker)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function load() {
  const mod = await import('./matchBgRemoveEngine')
  return mod.matchBgRemoveEngine
}

describe('matchBgRemoveEngine worker 编排', () => {
  it('成功路径：转移像素、写回 canvas、返回 ProcessResult', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const engine = await load()

    const p = engine(blobFile(), { tolerance: 0.2, feather: 0.1, quality: 0.8 })
    await vi.advanceTimersByTimeAsync(10)

    const w = FakeWorker.instances[0]!
    expect(w).toBeDefined()

    // 像素以 Transferable 转移（避免大图内存复制）
    const [payload, transfer] = w.postMessageArgs as [{ pixels: ArrayBuffer }, ArrayBuffer[]]
    expect(transfer).toEqual([payload.pixels])

    // 回传处理结果
    const processed = new ArrayBuffer(16)
    w.emit({ type: 'done', pixels: processed })

    const res = await p
    expect(res.blob).toBeInstanceOf(Blob)
    expect(res.size).toBeGreaterThan(0)
    expect(res.width).toBe(4)
    expect(res.height).toBe(4)
    expect(w.terminated).toBe(true)
  })

  it('progress 透传给 onProgress', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const engine = await load()
    const onProgress = vi.fn()

    const p = engine(blobFile(), { onProgress })
    await vi.advanceTimersByTimeAsync(10)

    const w = FakeWorker.instances[0]!
    w.emit({ type: 'progress', progress: 0.42 })
    expect(onProgress).toHaveBeenCalledWith(0.42)

    w.emit({ type: 'done', pixels: new ArrayBuffer(16) })
    await p
  })

  it('abort 后 terminate 并 reject，且错误可被 isAbortError 认出', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const engine = await load()
    const ctrl = new AbortController()

    const p = engine(blobFile(), { signal: ctrl.signal })
    await vi.advanceTimersByTimeAsync(10)
    const w = FakeWorker.instances[0]!

    ctrl.abort()

    await expect(p).rejects.toSatisfy(isAbortError)
    expect(w.terminated).toBe(true)
    // 清理：避免后续 120s 超时对已settle 的 promise 再 reject
    await vi.advanceTimersByTimeAsync(200_000)
  })

  it('abort 后 worker 再回 done 也不二次结算', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const engine = await load()
    const ctrl = new AbortController()

    const p = engine(blobFile(), { signal: ctrl.signal })
    await vi.advanceTimersByTimeAsync(10)
    const w = FakeWorker.instances[0]!

    ctrl.abort()
    const first = await p.catch((e) => e)

    //迟到的消息不应把状态改回去
    w.emit({ type: 'done', pixels: new ArrayBuffer(16) })
    await vi.advanceTimersByTimeAsync(10)

    const second = await p.catch((e) => e)
    expect(second).toBe(first)
    expect(isAbortError(second)).toBe(true)
  })

  it('重复 abort 只结算一次', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const engine = await load()
    const ctrl = new AbortController()

    const p = engine(blobFile(), { signal: ctrl.signal })
    await vi.advanceTimersByTimeAsync(10)
    const w = FakeWorker.instances[0]!

    ctrl.abort()
    ctrl.abort()
    ctrl.abort()

    await expect(p).rejects.toSatisfy(isAbortError)
    expect(w.terminated).toBe(true)
  })

  it('worker onerror reject 原错误并 terminate', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const engine = await load()

    const p = engine(blobFile(), {})
    await vi.advanceTimersByTimeAsync(10)
    const w = FakeWorker.instances[0]!

    const boom = new Error('boom')
    w.emitError(boom)

    await expect(p).rejects.toBe(boom)
    expect(w.terminated).toBe(true)
  })

  it('120s 超时兜底 reject，不永久挂起', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const engine = await load()

    const p = engine(blobFile(), {})
    // 提前挂 catch，避免推进计时器期间出现未处理的 rejection 窗口
    const settled = p.catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(10)
    const w = FakeWorker.instances[0]!

    await vi.advanceTimersByTimeAsync(120_000)

    const err = await settled
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toMatch(/120/)
    expect(w.terminated).toBe(true)
  })

  it('超时不误伤已完成的请求', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const engine = await load()

    const p = engine(blobFile(), {})
    await vi.advanceTimersByTimeAsync(10)
    const w = FakeWorker.instances[0]!

    // 先正常完成，再推进 120s：计时器应已清理，不应再 reject
    w.emit({ type: 'done', pixels: new ArrayBuffer(16) })
    const res = await p
    expect(res.blob).toBeInstanceOf(Blob)

    await vi.advanceTimersByTimeAsync(200_000)
    expect(res.blob).toBeInstanceOf(Blob)
  })

  it('signal 在进入 worker 前已中止时立即 reject，不建worker', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const engine = await load()
    const ctrl = new AbortController()
    ctrl.abort()

    await expect(engine(blobFile(), { signal: ctrl.signal })).rejects.toSatisfy(isAbortError)
    // worker 只在解码后创建；即便创建了也应已terminate
    for (const w of FakeWorker.instances) expect(w.terminated).toBe(true)
  })

  it('error 事件后迟到 done 不二次结算', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const engine = await load()

    const p = engine(blobFile(), {})
    await vi.advanceTimersByTimeAsync(10)
    const w = FakeWorker.instances[0]!

    const boom = new Error('boom')
    w.emitError(boom)
    const first = await p.catch((e) => e)

    w.emit({ type: 'done', pixels: new ArrayBuffer(16) })
    await vi.advanceTimersByTimeAsync(10)

    expect(await p.catch((e) => e)).toBe(first)
  })
})

describe('matchBgRemoveEngine abort 覆盖范围', () => {
  it('解码阶段（含 getImageData）之前就该响应 abort', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const engine = await load()
    const ctrl = new AbortController()

    // 故意让解码卡住：在 FileReader.onload 里才触发 abort
    class StallingReader {
      result: string | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL() {
        this.result = 'data:image/png;base64,'
        // 不自动 resolve，等外部推进
      }
    }
    vi.stubGlobal('FileReader', StallingReader)

    const p = engine(blobFile(), { signal: ctrl.signal })
    await vi.advanceTimersByTimeAsync(5)

    // 尚未解码完，此时中止
    ctrl.abort()
    await expect(p).rejects.toSatisfy(isAbortError)
  })
})
