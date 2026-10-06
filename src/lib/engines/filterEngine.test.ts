import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isAbortError } from './abort'

/**
 * filterEngine 的像素处理与编排。
 *
 * 此前零测试。而它是刚被改过 abort 挂载的地方（原先是永不remove 的
 * 匿名监听器），且 applySharpen 有一处边界缺陷——正是这类代码最容易
 * 悄悄坏掉的地方。
 *
 * 用可控的假 canvas / 假 Image 夹具，不依赖真实渲染。
 */

/** 记录 filter 字符串与各步调用顺序的假 ctx */
class FakeCtx {
  filter = 'none'
  fillStyle = ''
  globalCompositeOperation = ''
  calls: string[] = []
  filters: string[] = []
  width: number
  height: number

  constructor(w: number, h: number) {
    this.width = w
    this.height = h
  }

  drawImage() {
    this.calls.push('drawImage')
    this.filters.push(this.filter)
  }

  getImageData(_x: number, _y: number, w: number, h: number) {
    this.calls.push('getImageData')
    return makeImageData(w, h, 128)
  }

  putImageData() {
    this.calls.push('putImageData')
  }

  createRadialGradient(): { addColorStop: (o: number, c: string) => void } {
    this.calls.push('createRadialGradient')
    return { addColorStop: () => {} }
  }

  fillRect() {
    this.calls.push('fillRect')
  }

  createImageData(w: number, h: number) {
    this.calls.push('createImageData')
    return makeImageData(w, h, 0)
  }

  save() {
    this.calls.push('save')
  }

  restore() {
    this.calls.push('restore')
  }
}

/** 可独立构造的 ImageData 替身 */
function makeImageData(w: number, h: number, fill: number) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill
    data[i + 1] = fill
    data[i + 2] = fill
    data[i + 3] = 255
  }
  return { data, width: w, height: h, colorSpace: 'srgb' as const }
}

const contexts: FakeCtx[] = []
const canvases: Array<Record<string, unknown>> = []
let revokedUrls: string[] = []

beforeEach(() => {
  contexts.length = 0
  canvases.length = 0
  revokedUrls = []

  vi.stubGlobal(
    'ImageData',
    class {
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

  class FakeImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    width = 8
    height = 6
    naturalWidth = 8
    naturalHeight = 6
    set src(_v: string) {
      queueMicrotask(() => this.onload?.())
    }
  }
  vi.stubGlobal('Image', FakeImage)

  // 直接改写两个静态方法，保留 URL 构造函数本身（jsdom 内部要用）
  const realURL = globalThis.URL
  realURL.createObjectURL = () => 'blob:mock'
  realURL.revokeObjectURL = (u: string) => revokedUrls.push(u)

  vi.stubGlobal('document', {
    createElement: () => {
      const ctx = new FakeCtx(0, 0)
      const el: {
        width: number
        height: number
        getContext: () => FakeCtx
        toBlob: (cb: (b: Blob | null) => void, type?: string, quality?: number) => void
        __type?: string
        __quality?: number
      } = {
        width: 0,
        height: 0,
        getContext: () => {
          ctx.width = el.width
          ctx.height = el.height
          contexts.push(ctx)
          return ctx
        },
        toBlob: (cb: (b: Blob | null) => void, type?: string, quality?: number) => {
          el.__type = type
          el.__quality = quality
          cb(new Blob(['x'], { type: type ?? 'image/png' }))
        }
      }
      canvases.push(el as unknown as Record<string, unknown>)
      return el
    }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const pngFile = () => new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })

/** 全部滤镜参数的中性值（0 表示无效果） */
const NEUTRAL = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  hueRotate: 0,
  invert: 0,
  vignette: 0,
  noise: 0,
  sharpen: 0
}

async function run(opts: Partial<typeof NEUTRAL> & Record<string, unknown> = {}) {
  const { filterEngine } = await import('./filterEngine')
  return filterEngine(pngFile(), { ...NEUTRAL, ...opts })
}

describe('filterEngine CSS filter 串联', () => {
  it('把 8 个 CSS 滤镜合成一个 filter 字符串', async () => {
    await run({
      brightness: 120,
      contrast: 90,
      saturation: 150,
      blur: 2,
      grayscale: 30,
      sepia: 10,
      hueRotate: 45,
      invert: 5
    })

    expect(contexts[0]!.filters[0]).toBe(
      'brightness(120%) contrast(90%) saturate(150%) blur(2px) grayscale(30%) sepia(10%) hue-rotate(45deg) invert(5%)'
    )
  })

  it('drawImage 传入拟合后的尺寸', async () => {
    await run()
    //8x6 未超 MAX_PROCESS_SIDE，故原尺寸
    const el = canvases[0]!
    expect(el.width).toBe(8)
    expect(el.height).toBe(6)
  })
})

describe('filterEngine 可选步骤', () => {
  it('sharpen=0 时不读像素、不putImageData', async () => {
    await run({ sharpen: 0 })
    expect(contexts[0]!.calls).not.toContain('getImageData')
    expect(contexts[0]!.calls).not.toContain('putImageData')
  })

  it('sharpen>0 时读像素、卷积后写回，且把 filter 复位为 none', async () => {
    await run({ sharpen: 50 })
    const ctx = contexts[0]!
    expect(ctx.calls).toContain('getImageData')
    expect(ctx.calls).toContain('putImageData')
    // putImageData 前必须复位，避免再次污染
    expect(ctx.filter).toBe('none')
  })

  it('vignette>0 时创建径向渐变并填充', async () => {
    await run({ vignette: 60 })
    const ctx = contexts[0]!
    expect(ctx.calls).toContain('createRadialGradient')
    expect(ctx.calls).toContain('fillRect')
  })

  it('vignette=0 时不创建渐变', async () => {
    await run({ vignette: 0 })
    expect(contexts[0]!.calls).not.toContain('createRadialGradient')
  })

  it('noise>0 时用 screen 叠加，且保存/恢复上下文状态', async () => {
    await run({ noise: 30 })
    const ctx = contexts[0]!
    expect(ctx.calls).toContain('createImageData')
    expect(ctx.globalCompositeOperation).toBe('screen')
    expect(ctx.calls).toContain('save')
    expect(ctx.calls).toContain('restore')
  })

  it('noise=0 时不叠加', async () => {
    await run({ noise: 0 })
    expect(contexts[0]!.calls).not.toContain('createImageData')
  })
})

describe('filterEngine 输出格式与质量', () => {
  it("format='original' 落到 undefined 并回退 file.type", async () => {
    const res = await run({ format: 'original' })
    expect(res.format).toBe('image/png')
  })

  it('显式 format 透传', async () => {
    const res = await run({ format: 'image/webp' })
    expect(res.format).toBe('image/webp')
    expect(canvases[0]!.__type).toBe('image/webp')
  })

  it('quality 缺省 0.95', async () => {
    await run({ format: 'image/jpeg' })
    expect(canvases[0]!.__quality).toBe(0.95)
  })

  it('quality 显式透传', async () => {
    await run({ format: 'image/jpeg', quality: 0.6 })
    expect(canvases[0]!.__quality).toBe(0.6)
  })

  it('返回尺寸与尺寸字段齐备', async () => {
    const res = await run()
    expect(res.width).toBe(8)
    expect(res.height).toBe(6)
    expect(res.size).toBeGreaterThan(0)
    expect(res.blob).toBeInstanceOf(Blob)
  })
})

describe('filterEngine 资源清理', () => {
  it('解码成功后 revoke objectURL', async () => {
    await run()
    expect(revokedUrls).toEqual(['blob:mock'])
  })

  it('解码失败也 revoke objectURL', async () => {
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

    const { filterEngine } = await import('./filterEngine')
    await expect(filterEngine(pngFile(), { ...NEUTRAL })).rejects.toThrow('Failed to load image')
    expect(revokedUrls).toEqual(['blob:mock'])
  })
})

describe('filterEngine 中止', () => {
  it('解码前已中止：立即 reject 且不建canvas', async () => {
    const ctrl = new AbortController()
    ctrl.abort()

    const { filterEngine } = await import('./filterEngine')
    const settled = filterEngine(pngFile(), { ...NEUTRAL, signal: ctrl.signal }).catch((e) => e)

    const err = await settled
    expect(isAbortError(err)).toBe(true)
    expect(canvases).toHaveLength(0)
  })

  it('解码前中止：挂上监听器后立即生效（onAbort 补盲区）', async () => {
    class StallingImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      width = 8
      height = 6
      set src(_v: string) {
        // 不自动 onload，等外部推进
      }
    }
    vi.stubGlobal('Image', StallingImage)

    const { filterEngine } = await import('./filterEngine')
    const ctrl = new AbortController()
    const settled = filterEngine(pngFile(), { ...NEUTRAL, signal: ctrl.signal }).catch((e) => e)

    ctrl.abort()
    expect(isAbortError(await settled)).toBe(true)
    expect(revokedUrls).toEqual([])
  })

  it('中止后 reject 可被 isAbortError 认出（不再靠字符串匹配）', async () => {
    class StallingImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      width = 8
      height = 6
      set src(_v: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', StallingImage)

    const { filterEngine } = await import('./filterEngine')
    const ctrl = new AbortController()
    const settled = filterEngine(pngFile(), { ...NEUTRAL, signal: ctrl.signal }).catch((e) => e)
    ctrl.abort()

    const err = await settled
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).name).toBe('AbortError')
  })
})
