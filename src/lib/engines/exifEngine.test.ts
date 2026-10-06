import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isAbortError } from './abort'

/**
 * clearExifEngine。
 *
 * 此前零测试。而 ExifView 的 CTA 在「处理中」时对用户显示可点击中止
 * （本轮把它从 loading 改为可中止），引擎却完全没有 signal 处理——
 * 界面上按钮可点，实际点了没反应。
 */

const contexts: Array<{ filter: string; calls: string[] }> = []
/** 记录 toBlob 收到的 type/quality，用于断言输出格式与质量 */
const canvases: Array<Record<string, unknown>> = []
let revoked: string[] = []

beforeEach(() => {
  contexts.length = 0
  canvases.length = 0
  revoked = []

  class FakeImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    width = 8
    height = 6
    naturalWidth = 8
    naturalHeight = 6
    private _src = ''
    get src() {
      return this._src
    }
    set src(v: string) {
      this._src = v
      if (v) queueMicrotask(() => this.onload?.())
    }
  }
  vi.stubGlobal('Image', FakeImage)

  const realURL = globalThis.URL
  realURL.createObjectURL = () => 'blob:mock'
  realURL.revokeObjectURL = (u: string) => revoked.push(u)

  vi.stubGlobal('document', {
    createElement: () => {
      const ctx = {
        filter: 'none',
        calls: [] as string[],
        drawImage: () => ctx.calls.push('drawImage')
      }
      contexts.push(ctx)
      const el: {
        width: number
        height: number
        getContext: () => unknown
        toBlob: (cb: (b: Blob | null) => void, type?: string, quality?: number) => void
        __type?: string
        __quality?: number
      } = {
        width: 0,
        height: 0,
        getContext: () => ctx,
        toBlob: (cb: (b: Blob | null) => void, type?: string, quality?: number) => {
          el.__type = type
          el.__quality = quality
          cb(new Blob(['x'], { type: type ?? 'image/png' }))
        }
      }
      canvases.push(el as unknown as Record<string, unknown>)
      return el as unknown as HTMLCanvasElement
    }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const jpegFile = (type = 'image/jpeg') => new File([new Uint8Array([1])], 'a.jpg', { type })

async function run(opts: Record<string, unknown> = {}) {
  const { clearExifEngine } = await import('./exifEngine')
  return clearExifEngine(jpegFile(), opts)
}

describe('clearExifEngine 输出格式', () => {
  it("format='original' 回退到 file.type", async () => {
    const res = await run({ format: 'original' })
    expect(res.format).toBe('image/jpeg')
    expect(canvases[0]!.__type).toBe('image/jpeg')
  })

  it('format 缺省同样回退到 file.type', async () => {
    const res = await run()
    expect(res.format).toBe('image/jpeg')
  })

  it("'image/jpeg-li' 映射为标准 image/jpeg（避免静默回退 PNG）", async () => {
    const res = await run({ format: 'image/jpeg-li' })
    expect(res.format).toBe('image/jpeg')
    expect(canvases[0]!.__type).toBe('image/jpeg')
  })

  it('显式 format 透传', async () => {
    const res = await run({ format: 'image/webp' })
    expect(res.format).toBe('image/webp')
  })

  it('quality 缺省 0.95，显式值透传', async () => {
    await run()
    expect(canvases[0]!.__quality).toBe(0.95)
    canvases.length = 0
    await run({ quality: 0.7 })
    expect(canvases[0]!.__quality).toBe(0.7)
  })
})

describe('clearExifEngine 渲染', () => {
  it('drawImage 传入拟合后的尺寸，返回同尺寸', async () => {
    const res = await run()
    expect(contexts[0]!.calls).toContain('drawImage')
    expect(res.width).toBe(8)
    expect(res.height).toBe(6)
    expect(res.blob).toBeInstanceOf(Blob)
    expect(res.size).toBeGreaterThan(0)
  })

  it('成功后回收 objectURL', async () => {
    await run()
    expect(revoked).toEqual(['blob:mock'])
  })
})

describe('clearExifEngine 错误路径', () => {
  it('getContext 返回 null 时拒绝', async () => {
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => null, toBlob: () => {} })
    })
    await expect(run()).rejects.toThrow('Failed to get canvas context')
  })

  it('toBlob 返回 null 时拒绝', async () => {
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: () => {} }),
        toBlob: (cb: (b: Blob | null) => void) => cb(null)
      })
    })
    await expect(run()).rejects.toThrow('Canvas toBlob failed')
  })

  it('图片加载失败时拒绝并回收 URL', async () => {
    class FailingImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      width = 8
      height = 6
      set src(_v: string) {
        queueMicrotask(() => this.onerror?.())
      }
    }
    vi.stubGlobal('Image', FailingImage)
    await expect(run()).rejects.toThrow('Failed to load image')
    expect(revoked).toEqual(['blob:mock'])
  })
})

describe('clearExifEngine 中止', () => {
  it('signal 一开始就已中止：立即 reject，不解码', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const { clearExifEngine } = await import('./exifEngine')
    const err = await clearExifEngine(jpegFile(), { signal: ctrl.signal }).catch((e) => e)
    expect(isAbortError(err)).toBe(true)
    expect(canvases).toHaveLength(0)
  })

  it('解码过程中 abort：reject 且错误可被 isAbortError 认出', async () => {
    class StallingImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      width = 8
      height = 6
      set src(_v: string) {
        // 不自动 onload
      }
    }
    vi.stubGlobal('Image', StallingImage)

    const ctrl = new AbortController()
    const { clearExifEngine } = await import('./exifEngine')
    const settled = clearExifEngine(jpegFile(), { signal: ctrl.signal }).catch((e) => e)
    ctrl.abort()

    const err = await settled
    expect(isAbortError(err)).toBe(true)
    expect((err as Error).name).toBe('AbortError')
    expect(canvases).toHaveLength(0)
  })
})
