import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { splitEngine } from './splitEngine'

/**
 * splitEngine 回归测试（P1-2 零宽/零高切片报错 / P2-4 centerMode 边缘采样）
 *
 * Mock 策略：document.createElement('canvas') spy 返回 MockCanvas，ctx.getImageData
 * 按测试配置返回边缘采样色（1×1）与内容像素（全尺寸），覆盖 sampleEdgeBg/getContentBounds
 * 的观察路径；global.Image 桩由测试手动触发 onload。
 */

const DEFAULT_BLOB = Symbol('default')

type MockFn = Mock

interface MockCtx {
  drawImage: MockFn
  fillRect: MockFn
  getImageData: MockFn
  fillStyle: string
  canvas?: MockCanvas
}

interface MockCanvas {
  width: number
  height: number
  ctx: MockCtx
  getContext: MockFn
  toBlob: MockFn
}

interface MockImageInstance {
  width: number
  height: number
  onload: (() => void) | null
  onerror: (() => void) | null
}

interface ContentPixel {
  x: number
  y: number
  rgb: [number, number, number]
}

const state = {
  imageProps: { width: 100, height: 100 },
  images: [] as MockImageInstance[],
  firedCount: 0,
  canvases: [] as MockCanvas[],
  toBlobPayload: undefined as unknown as Blob | null | typeof DEFAULT_BLOB,
  ctxNull: false,
  // getImageData 行为
  edgeColor: [255, 255, 255, 255] as number[],
  edgeExceptions: {} as Record<string, number[]>,
  contentPixels: [] as ContentPixel[]
}

class MockImage implements MockImageInstance {
  width: number
  height: number
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    this.width = state.imageProps.width
    this.height = state.imageProps.height
    state.images.push(this)
  }
  set src(_v: string) {
    /* onload 由测试手动触发 */
  }
}

function makeCtx(): MockCtx {
  return {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn((x: number, y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4)
      if (w === 1 && h === 1) {
        const ex = state.edgeExceptions[`${x},${y}`] ?? state.edgeColor
        data[0] = ex[0]!
        data[1] = ex[1]!
        data[2] = ex[2]!
        data[3] = ex[3] ?? 255
      } else {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255
          data[i + 1] = 255
          data[i + 2] = 255
          data[i + 3] = 255
        }
        for (const p of state.contentPixels) {
          const idx = (p.y * w + p.x) * 4
          if (idx >= 0 && idx + 3 < data.length) {
            data[idx] = p.rgb[0]
            data[idx + 1] = p.rgb[1]
            data[idx + 2] = p.rgb[2]
            data[idx + 3] = 255
          }
        }
      }
      return { data }
    }),
    fillStyle: ''
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
          ? new Blob(['x'], { type: 'image/png' })
          : state.toBlobPayload
      cb(payload)
    })
  }
  ctx.canvas = canvas
  state.canvases.push(canvas)
  return canvas
}

/** 仅触发自上次调用以来新建的 Image（onload），避免重复触发旧任务 */
function fireImages() {
  for (let i = state.firedCount; i < state.images.length; i++) {
    state.images[i]!.onload?.()
  }
  state.firedCount = state.images.length
}

beforeEach(() => {
  state.imageProps = { width: 100, height: 100 }
  state.images = []
  state.firedCount = 0
  state.canvases = []
  state.toBlobPayload = DEFAULT_BLOB
  state.ctxNull = false
  state.edgeColor = [255, 255, 255, 255]
  state.edgeExceptions = {}
  state.contentPixels = []

  vi.stubGlobal('Image', MockImage)
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
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

describe('splitEngine 预检与网格切分', () => {
  it('空文件（size 0）直接抛错', async () => {
    const empty = new File([], 'x.png', { type: 'image/png' })
    await expect(splitEngine(empty, { rows: 2, cols: 2, mode: 'grid' })).rejects.toThrow(
      '无效的图片文件'
    )
  })

  it('图片尺寸为 0 时抛错', async () => {
    state.imageProps = { width: 0, height: 0 }
    const promise = splitEngine(makeFile(), { rows: 2, cols: 2, mode: 'grid' })
    fireImages()
    await expect(promise).rejects.toThrow('图片尺寸无效')
  })

  it('网格 2×2 生成 4 个切片且绘制区域正确', async () => {
    state.imageProps = { width: 100, height: 100 }
    const promise = splitEngine(makeFile(), { rows: 2, cols: 2, mode: 'grid' })
    fireImages()
    const result = await promise
    expect(result.blobs).toHaveLength(4)
    expect(result.size).toBe(4) // 每片 1 字节
    // 每片 9 参 drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
    const calls = state.canvases.map((c) => c.ctx.drawImage.mock.calls)
    expect(calls).toHaveLength(4)
    expect(calls[0]![0]![3]).toBe(50)
    expect(calls[0]![0]![4]).toBe(50)
    expect(calls[1]![0]![1]).toBe(50) // 第二片起点 x = 50
  })

  it('进度回调按切片数推进 0.25 → 1', async () => {
    state.imageProps = { width: 100, height: 100 }
    const progresses: number[] = []
    const promise = splitEngine(makeFile(), {
      rows: 2,
      cols: 2,
      mode: 'grid',
      onProgress: (p) => progresses.push(p)
    })
    fireImages()
    await promise
    expect(progresses).toEqual([0.25, 0.5, 0.75, 1])
  })

  it('custom 分割线自动排序后按边界切分', async () => {
    state.imageProps = { width: 600, height: 400 }
    const promise = splitEngine(makeFile(), {
      rows: 1,
      cols: 2,
      mode: 'custom',
      customLines: { x: [400, 100], y: [] }
    })
    fireImages()
    await promise
    const calls = state.canvases.map((c) => c.ctx.drawImage.mock.calls)
    expect(calls).toHaveLength(3)
    expect(calls[0]![0]![3]).toBe(100) // 0 → 100
    expect(calls[1]![0]![3]).toBe(300) // 100 → 400
    expect(calls[2]![0]![3]).toBe(200) // 400 → 600
  })
})

describe('splitEngine 零宽/零高切片', () => {
  it('custom 分割线重复导致零宽切片 → 抛错而非静默跳过', async () => {
    state.imageProps = { width: 600, height: 400 }
    const promise = splitEngine(makeFile(), {
      rows: 1,
      cols: 2,
      mode: 'custom',
      customLines: { x: [300, 300], y: [] }
    })
    fireImages()
    await expect(promise).rejects.toThrow(/切片尺寸为零/)
  })

  it('shave 超过切片一半导致零宽切片 → 抛错', async () => {
    state.imageProps = { width: 100, height: 100 }
    const promise = splitEngine(makeFile(), { rows: 1, cols: 1, mode: 'grid', shave: 60 })
    fireImages()
    await expect(promise).rejects.toThrow(/切片尺寸为零/)
  })

  it('无效行列参数产生 0 切片 → 抛错', async () => {
    state.imageProps = { width: 100, height: 100 }
    const promise = splitEngine(makeFile(), { rows: 1, cols: 0, mode: 'grid' })
    fireImages()
    await expect(promise).rejects.toThrow('切分参数导致无有效切片生成')
  })
})

describe('splitEngine centerMode 背景采样', () => {
  it('square：四角+中位数采样背景，内容居中到方形画布', async () => {
    state.imageProps = { width: 20, height: 10 }
    state.contentPixels = [{ x: 10, y: 5, rgb: [0, 0, 0] }]
    const promise = splitEngine(makeFile(), {
      rows: 1,
      cols: 1,
      centerMode: 'square',
      mode: 'grid'
    })
    fireImages()
    const result = await promise
    const mainCtx = state.canvases[0]!.ctx
    expect(mainCtx.fillStyle).toBe('rgba(255, 255, 255, 1)')
    expect(mainCtx.fillRect).toHaveBeenCalledWith(0, 0, 20, 20) // 扩展为方形
    // 内容块 (10,5,1,1) 居中 → dest (9.5, 9.5)
    expect(mainCtx.drawImage).toHaveBeenCalledWith(state.canvases[1], 10, 5, 1, 1, 9.5, 9.5, 1, 1)
    expect(result.blobs).toHaveLength(1)
  })

  it('center：保持原宽高比，内容垂直居中', async () => {
    state.imageProps = { width: 20, height: 10 }
    state.contentPixels = [{ x: 10, y: 5, rgb: [0, 0, 0] }]
    const promise = splitEngine(makeFile(), {
      rows: 1,
      cols: 1,
      centerMode: 'center',
      mode: 'grid'
    })
    fireImages()
    await promise
    const mainCtx = state.canvases[0]!.ctx
    expect(mainCtx.fillRect).toHaveBeenCalledWith(0, 0, 20, 10)
    expect(mainCtx.drawImage).toHaveBeenCalledWith(state.canvases[1], 10, 5, 1, 1, 9.5, 4.5, 1, 1)
  })

  it('背景采样取中位数：单角噪点不影响结果', async () => {
    state.imageProps = { width: 20, height: 10 }
    state.edgeExceptions['0,0'] = [255, 0, 0, 255] // 左上角噪点
    state.contentPixels = [{ x: 10, y: 5, rgb: [0, 0, 0] }]
    const promise = splitEngine(makeFile(), {
      rows: 1,
      cols: 1,
      centerMode: 'center',
      mode: 'grid'
    })
    fireImages()
    await promise
    expect(state.canvases[0]!.ctx.fillStyle).toBe('rgba(255, 255, 255, 1)')
  })

  it('透明背景（中位 alpha<64）返回 null → 直接平铺原内容', async () => {
    state.imageProps = { width: 10, height: 10 }
    state.edgeColor = [255, 255, 255, 0]
    state.contentPixels = [{ x: 5, y: 5, rgb: [0, 0, 0] }]
    const promise = splitEngine(makeFile(), {
      rows: 1,
      cols: 1,
      centerMode: 'center',
      mode: 'grid'
    })
    fireImages()
    await promise
    const mainCtx = state.canvases[0]!.ctx
    expect(mainCtx.fillRect).not.toHaveBeenCalled()
    // 平铺路径：9 参 drawImage(img, 0, 0, 10, 10, 0, 0, 10, 10)
    expect(mainCtx.drawImage).toHaveBeenCalledWith(state.images[0], 0, 0, 10, 10, 0, 0, 10, 10)
  })
})

describe('splitEngine 错误路径与中止', () => {
  it('切片编码失败（toBlob null）→ 整体失败', async () => {
    state.imageProps = { width: 100, height: 100 }
    state.toBlobPayload = null
    const promise = splitEngine(makeFile(), { rows: 1, cols: 1, mode: 'grid' })
    fireImages()
    await expect(promise).rejects.toThrow('切片编码失败')
  })

  it('Canvas 上下文获取失败 → 抛错', async () => {
    state.imageProps = { width: 100, height: 100 }
    state.ctxNull = true
    const promise = splitEngine(makeFile(), { rows: 1, cols: 1, mode: 'grid' })
    fireImages()
    await expect(promise).rejects.toThrow('无法初始化 Canvas 绘图上下文')
  })

  it('已中止 signal → AbortError 且不产出结果', async () => {
    state.imageProps = { width: 100, height: 100 }
    const controller = new AbortController()
    controller.abort()
    const promise = splitEngine(makeFile(), {
      rows: 2,
      cols: 2,
      mode: 'grid',
      signal: controller.signal
    })
    fireImages()
    await expect(promise).rejects.toThrow('AbortError')
  })
})
