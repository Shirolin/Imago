import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { resizeEngine } from './resizeEngine'

/**
 * resizeEngine 回归测试（P0 输入钳制 / maintainAspectRatio 双值不改写 / percentage 下限）
 *
 * Mock 策略：global.createImageBitmap 桩为可控尺寸的 ImageBitmap；jsdom 无 OffscreenCanvas，
 * 默认走 document.createElement('canvas') 回退路径（MockCanvas.toBlob 直接回调），
 * 另有一组用例 stub global.OffscreenCanvas 覆盖 convertToBlob 分支。
 */

const DEFAULT_BLOB = Symbol('default')

type MockFn = Mock

interface MockCtx {
  drawImage: MockFn
  imageSmoothingEnabled: boolean
  imageSmoothingQuality: string
}

interface MockCanvas {
  width: number
  height: number
  ctx: MockCtx
  getContext: MockFn
  toBlob: MockFn
}

interface MockBitmap {
  width: number
  height: number
  close: MockFn
}

const state = {
  bitmapProps: { width: 1000, height: 500 },
  bitmapClose: null as MockFn | null,
  canvases: [] as MockCanvas[],
  toBlobPayload: undefined as unknown as Blob | null | typeof DEFAULT_BLOB,
  ctxNull: false,
  offscreenInstance: null as any
}

function makeCtx(): MockCtx {
  return {
    drawImage: vi.fn(),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: ''
  }
}

function makeCanvas(): MockCanvas {
  const ctx = makeCtx()
  const canvas: MockCanvas = {
    width: 0,
    height: 0,
    ctx,
    getContext: vi.fn(() => (state.ctxNull ? null : ctx)),
    toBlob: vi.fn((cb: (b: Blob | null) => void) => {
      const payload =
        state.toBlobPayload === DEFAULT_BLOB
          ? new Blob(['img'], { type: 'image/png' })
          : state.toBlobPayload
      cb(payload)
    })
  }
  state.canvases.push(canvas)
  return canvas
}

class MockOffscreenCanvas {
  width: number
  height: number
  ctx = makeCtx()
  convertToBlob = vi.fn(
    async (opts: { type: string; quality: number }) => new Blob(['off'], { type: opts.type })
  )
  constructor(w: number, h: number) {
    this.width = w
    this.height = h
    state.offscreenInstance = this
  }
  getContext = vi.fn(() => (state.ctxNull ? null : this.ctx))
}

beforeEach(() => {
  state.bitmapProps = { width: 1000, height: 500 }
  state.bitmapClose = null
  state.canvases = []
  state.toBlobPayload = DEFAULT_BLOB
  state.ctxNull = false
  state.offscreenInstance = null

  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (): Promise<MockBitmap> => {
      const bitmap: MockBitmap = {
        width: state.bitmapProps.width,
        height: state.bitmapProps.height,
        close: vi.fn()
      }
      state.bitmapClose = bitmap.close
      return bitmap
    })
  )
  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: object) => {
    if (tag === 'canvas') return makeCanvas() as unknown as HTMLCanvasElement
    return originalCreateElement(tag, options)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function makeFile(): File {
  return new File(['x'], 'a.png', { type: 'image/png' })
}

describe('resizeEngine 尺寸钳制', () => {
  it('像素模式：0 宽高被钳制到 1', async () => {
    const result = await resizeEngine(makeFile(), { mode: 'pixels', width: 0, height: 0 })
    expect(result.width).toBe(1)
    expect(result.height).toBe(1)
  })

  it('像素模式：负值被钳制到 1', async () => {
    const result = await resizeEngine(makeFile(), { mode: 'pixels', width: -50, height: -5 })
    expect(result.width).toBe(1)
    expect(result.height).toBe(1)
  })

  it('像素模式：超大值被钳制到 16384（防 OffscreenCanvas 崩溃）', async () => {
    const result = await resizeEngine(makeFile(), {
      mode: 'pixels',
      width: 999999,
      height: 1_000_000
    })
    expect(result.width).toBe(16384)
    expect(result.height).toBe(16384)
  })

  it('百分比模式：放大超大图后钳制到 16384 长边', async () => {
    state.bitmapProps = { width: 12000, height: 8000 }
    const result = await resizeEngine(makeFile(), { mode: 'percentage', percentage: 200 })
    expect(result.width).toBe(16384)
    expect(result.height).toBe(10923)
  })

  it('maintainAspectRatio 双值输入不被改写（9999 保持 9999 而非 9998）', async () => {
    const result = await resizeEngine(makeFile(), {
      mode: 'pixels',
      width: 9999,
      height: 9999,
      maintainAspectRatio: true
    })
    expect(result.width).toBe(9999)
    expect(result.height).toBe(9999)
  })

  it('maintainAspectRatio 只给宽：高按原图比例推算', async () => {
    state.bitmapProps = { width: 1000, height: 500 }
    const result = await resizeEngine(makeFile(), {
      mode: 'pixels',
      width: 2000,
      maintainAspectRatio: true
    })
    expect(result.width).toBe(2000)
    expect(result.height).toBe(1000)
  })

  it('maintainAspectRatio 只给高：宽按原图比例推算', async () => {
    state.bitmapProps = { width: 1000, height: 500 }
    const result = await resizeEngine(makeFile(), {
      mode: 'pixels',
      height: 250,
      maintainAspectRatio: true
    })
    expect(result.width).toBe(500)
    expect(result.height).toBe(250)
  })
})

describe('resizeEngine percentage 模式', () => {
  it('50% 缩小一半', async () => {
    const result = await resizeEngine(makeFile(), { mode: 'percentage', percentage: 50 })
    expect(result.width).toBe(500)
    expect(result.height).toBe(250)
  })

  it('200% 放大一倍', async () => {
    const result = await resizeEngine(makeFile(), { mode: 'percentage', percentage: 200 })
    expect(result.width).toBe(2000)
    expect(result.height).toBe(1000)
  })

  it('0% 下限为 1（Math.max(1, …)）', async () => {
    const result = await resizeEngine(makeFile(), { mode: 'percentage', percentage: 0 })
    expect(result.width).toBe(1)
    expect(result.height).toBe(1)
  })
})

describe('resizeEngine 绘制与输出', () => {
  it('drawImage 使用钳制后的目标尺寸，toBlob 接收格式与质量', async () => {
    const result = await resizeEngine(makeFile(), { mode: 'pixels', width: 640, height: 480 })
    const canvas = state.canvases[0]!
    expect(canvas.width).toBe(640)
    expect(canvas.height).toBe(480)
    expect(canvas.ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 640, 480)
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png', 0.9)
    expect(result.width).toBe(640)
    expect(result.height).toBe(480)
  })

  it('OffscreenCanvas 路径使用 convertToBlob', async () => {
    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas)
    const result = await resizeEngine(makeFile(), {
      mode: 'pixels',
      format: 'image/webp',
      quality: 0.8
    })
    const off = state.offscreenInstance!
    expect(off.convertToBlob).toHaveBeenCalledWith({ type: 'image/webp', quality: 0.8 })
    expect(result.blob!.type).toBe('image/webp')
    expect(result.width).toBe(1000)
    expect(result.height).toBe(500)
  })
})

describe('resizeEngine 错误路径与中止', () => {
  it('已中止 signal：直接拒绝且不创建画布', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      resizeEngine(makeFile(), { mode: 'pixels', signal: controller.signal })
    ).rejects.toThrow('Task aborted')
    expect(state.canvases).toHaveLength(0)
  })

  it('toBlob 返回 null：拒绝并释放 bitmap', async () => {
    state.toBlobPayload = null
    await expect(resizeEngine(makeFile(), { mode: 'pixels' })).rejects.toThrow(
      'Canvas toBlob failed'
    )
    expect(state.bitmapClose).toHaveBeenCalled()
  })

  it('getContext 返回 null 时拒绝', async () => {
    state.ctxNull = true
    await expect(resizeEngine(makeFile(), { mode: 'pixels' })).rejects.toThrow(
      'Failed to get canvas context'
    )
  })
})
