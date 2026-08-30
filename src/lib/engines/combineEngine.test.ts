import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { combineEngine } from './combineEngine'
import { MAX_COMBINE_CANVAS_AREA, MAX_COMBINE_CANVAS_SIDE } from '../limits'

const MAX_CANVAS_SIDE = MAX_COMBINE_CANVAS_SIDE
const MAX_CANVAS_AREA = MAX_COMBINE_CANVAS_AREA
const DEFAULT_BLOB = Symbol('default')

type MockFn = Mock

interface MockCtx {
  drawImage: MockFn
  scale: MockFn
  save: MockFn
  restore: MockFn
  beginPath: MockFn
  rect: MockFn
  roundRect: MockFn
  clip: MockFn
  clearRect: MockFn
  fillRect: MockFn
  fillStyle: string
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

const state = {
  imageDims: [] as Array<{ width: number; height: number }>,
  failImage: false,
  images: [] as MockImageInstance[],
  firedCount: 0,
  canvases: [] as MockCanvas[],
  toBlobPayload: undefined as unknown as Blob | null | typeof DEFAULT_BLOB,
  ctxNull: false,
  /** 模拟画布尺寸赋值被拒绝（缩小取整后归零的极端情形） */
  freezeCanvasSizes: false
}

class MockImage implements MockImageInstance {
  width: number
  height: number
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    const dims = state.imageDims.shift() ?? { width: 100, height: 100 }
    this.width = dims.width
    this.height = dims.height
    state.images.push(this)
  }
  set src(_v: string) {
    /* onload 由测试手动触发 */
  }
}

function makeCtx(): MockCtx {
  return {
    drawImage: vi.fn(),
    scale: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
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
          ? new Blob(['c'], { type: 'image/png' })
          : state.toBlobPayload
      cb(payload)
    })
  }
  if (state.freezeCanvasSizes) {
    Object.defineProperty(canvas, 'width', { get: () => 0, set: () => {} })
    Object.defineProperty(canvas, 'height', { get: () => 0, set: () => {} })
  }
  state.canvases.push(canvas)
  return canvas
}

function fireImages() {
  for (let i = state.firedCount; i < state.images.length; i++) {
    const img = state.images[i]!
    if (state.failImage) img.onerror?.()
    else img.onload?.()
  }
  state.firedCount = state.images.length
}

beforeEach(() => {
  state.imageDims = []
  state.failImage = false
  state.images = []
  state.firedCount = 0
  state.canvases = []
  state.toBlobPayload = DEFAULT_BLOB
  state.ctxNull = false
  state.freezeCanvasSizes = false

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

function makeFiles(count: number): File[] {
  return Array.from(
    { length: count },
    (_, i) => new File([String(i)], `a${i}.png`, { type: 'image/png' })
  )
}

function run(files: File[], options: Parameters<typeof combineEngine>[1]) {
  const promise = combineEngine(files, options)
  fireImages()
  return promise
}

describe('combineEngine 基础校验', () => {
  it('空文件列表抛错', async () => {
    await expect(
      combineEngine([], {
        direction: 'vertical',
        spacing: 0,
        backgroundColor: 'transparent',
        alignment: 'start'
      })
    ).rejects.toThrow('未选择任何图片进行拼接')
  })

  it('图片加载失败抛错并回收 URL', async () => {
    state.failImage = true
    const files = makeFiles(1)
    const promise = combineEngine(files, {
      direction: 'vertical',
      spacing: 0,
      backgroundColor: 'transparent',
      alignment: 'start'
    })
    fireImages()
    await expect(promise).rejects.toThrow('图片加载失败: a0.png')
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })
})

describe('combineEngine 布局计算', () => {
  it('纵向智能布局：宽度对齐最大宽度、高度等比', async () => {
    state.imageDims = [
      { width: 200, height: 100 },
      { width: 100, height: 100 }
    ]
    const result = await run(makeFiles(2), {
      direction: 'vertical',
      spacing: 10,
      backgroundColor: 'transparent',
      alignment: 'start'
    })
    expect(result.width).toBe(200)
    expect(result.height).toBe(310) // 100 + 10 + 200 - 尾部间距 10
    const canvas = state.canvases[0]!
    expect(canvas.width).toBe(200)
    expect(canvas.height).toBe(310)
    expect(canvas.ctx.drawImage).toHaveBeenNthCalledWith(1, state.images[0], 0, 0, 200, 100)
    expect(canvas.ctx.drawImage).toHaveBeenNthCalledWith(2, state.images[1], 0, 110, 200, 200)
    expect(canvas.ctx.scale).not.toHaveBeenCalled() // 未超限不缩放
  })

  it('横向智能布局：高度对齐最大高度', async () => {
    state.imageDims = [
      { width: 100, height: 200 },
      { width: 200, height: 100 }
    ]
    const result = await run(makeFiles(2), {
      direction: 'horizontal',
      spacing: 10,
      backgroundColor: 'transparent',
      alignment: 'start'
    })
    expect(result.width).toBe(510) // 100 + 10 + 400 - 尾部间距 10
    expect(result.height).toBe(200)
    const canvas = state.canvases[0]!
    expect(canvas.ctx.drawImage).toHaveBeenNthCalledWith(1, state.images[0], 0, 0, 100, 200)
    expect(canvas.ctx.drawImage).toHaveBeenNthCalledWith(2, state.images[1], 110, 0, 400, 200)
  })

  it('网格智能布局：Cover 填满单元格并裁剪溢出', async () => {
    state.imageDims = [
      { width: 100, height: 50 },
      { width: 50, height: 100 }
    ]
    const result = await run(makeFiles(2), {
      direction: 'grid',
      spacing: 0,
      backgroundColor: 'transparent',
      columns: 2,
      alignment: 'start'
    })
    const canvas = state.canvases[0]!
    expect(result.width).toBe(200)
    expect(result.height).toBe(100)
    expect(canvas.ctx.clip).toHaveBeenCalledTimes(2)
    // img1: ratio = max(100/100, 100/50) = 2 → 200×100，offsetX = (100-200)/2 = -50
    expect(canvas.ctx.drawImage).toHaveBeenNthCalledWith(1, state.images[0], -50, 0, 200, 100)
    // img2: ratio = 2 → 100×200，offsetY = -50 → x = 100
    expect(canvas.ctx.drawImage).toHaveBeenNthCalledWith(2, state.images[1], 100, -50, 100, 200)
  })

  it('网格原始布局：end 对齐单元格右/下边缘', async () => {
    state.imageDims = [
      { width: 60, height: 40 },
      { width: 30, height: 30 }
    ]
    await run(makeFiles(2), {
      direction: 'grid',
      spacing: 0,
      backgroundColor: 'transparent',
      columns: 2,
      layoutMode: 'original',
      alignment: 'end'
    })
    const canvas = state.canvases[0]!
    // img2: x = c*(cellW+spacing) + (cellW - width) = 60 + 30
    expect(canvas.ctx.drawImage).toHaveBeenNthCalledWith(2, state.images[1], 90, 10, 30, 30)
  })

  it('纵向原始布局：center 对齐水平居中', async () => {
    state.imageDims = [
      { width: 100, height: 50 },
      { width: 50, height: 50 }
    ]
    await run(makeFiles(2), {
      direction: 'vertical',
      spacing: 0,
      backgroundColor: 'transparent',
      layoutMode: 'original',
      alignment: 'center'
    })
    const canvas = state.canvases[0]!
    expect(canvas.ctx.drawImage).toHaveBeenNthCalledWith(1, state.images[0], 0, 0, 100, 50)
    expect(canvas.ctx.drawImage).toHaveBeenNthCalledWith(2, state.images[1], 25, 50, 50, 50)
  })

  it('圆角：roundRect + clip 生效', async () => {
    state.imageDims = [{ width: 100, height: 100 }]
    await run(makeFiles(1), {
      direction: 'vertical',
      spacing: 0,
      backgroundColor: 'transparent',
      borderRadius: 20,
      alignment: 'start'
    })
    const ctx = state.canvases[0]!.ctx
    expect(ctx.roundRect).toHaveBeenCalledWith(0, 0, 100, 100, 20)
    expect(ctx.clip).toHaveBeenCalled()
  })
})

describe('combineEngine 背景与导出', () => {
  it('非透明背景填充 fillStyle + fillRect', async () => {
    state.imageDims = [{ width: 100, height: 100 }]
    await run(makeFiles(1), {
      direction: 'vertical',
      spacing: 0,
      backgroundColor: '#abcdef',
      alignment: 'start'
    })
    const ctx = state.canvases[0]!.ctx
    expect(ctx.fillStyle).toBe('#abcdef')
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100)
    expect(ctx.clearRect).not.toHaveBeenCalled()
  })

  it('transparent 背景使用 clearRect', async () => {
    state.imageDims = [{ width: 100, height: 100 }]
    await run(makeFiles(1), {
      direction: 'vertical',
      spacing: 0,
      backgroundColor: 'transparent',
      alignment: 'start'
    })
    const ctx = state.canvases[0]!.ctx
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 100)
    expect(ctx.fillRect).not.toHaveBeenCalled()
  })

  it('输出格式透传：默认 PNG、可指定 JPEG、original 回退 PNG', async () => {
    state.imageDims = [{ width: 100, height: 100 }]
    const files = makeFiles(1)
    const base = {
      direction: 'vertical' as const,
      spacing: 0,
      backgroundColor: 'transparent',
      alignment: 'start' as const
    }

    await run(files, { ...base })
    expect(state.canvases[0]!.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png', 0.9)

    state.canvases = []
    state.images = []
    state.firedCount = 0
    state.imageDims = [{ width: 100, height: 100 }]
    await run(files, { ...base, format: 'image/jpeg', quality: 0.7 })
    expect(state.canvases[0]!.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.7)

    state.canvases = []
    state.images = []
    state.firedCount = 0
    state.imageDims = [{ width: 100, height: 100 }]
    const result = await run(files, { ...base, format: 'original' })
    expect(state.canvases[0]!.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png', 0.9)
    expect(result.format).toBe('image/png')
  })
})

describe('combineEngine 尺寸上限缩小（P0-2）', () => {
  it('总面积超 268M 像素 → 按比例缩小且面积/单边不超限', async () => {
    state.imageDims = [
      { width: 20000, height: 20000 },
      { width: 20000, height: 20000 }
    ]
    const result = await run(makeFiles(2), {
      direction: 'vertical',
      spacing: 0,
      backgroundColor: 'transparent',
      alignment: 'start'
    })
    const canvas = state.canvases[0]!
    const rawW = 20000
    const rawH = 40000
    const scale = Math.min(
      MAX_CANVAS_SIDE / rawW,
      MAX_CANVAS_SIDE / rawH,
      Math.sqrt(MAX_CANVAS_AREA / (rawW * rawH))
    )
    expect(scale).toBeLessThan(1)
    expect(canvas.width).toBe(Math.max(1, Math.floor(rawW * scale)))
    expect(canvas.height).toBe(Math.max(1, Math.floor(rawH * scale)))
    expect(canvas.width).toBeLessThanOrEqual(MAX_CANVAS_SIDE)
    expect(canvas.height).toBeLessThanOrEqual(MAX_CANVAS_SIDE)
    expect(canvas.width * canvas.height).toBeLessThanOrEqual(MAX_CANVAS_AREA)
    expect(canvas.ctx.scale).toHaveBeenCalledWith(scale, scale)
    expect(result.width).toBe(canvas.width)
  })

  it('单边超 32767 → 缩小后单边不超限', async () => {
    state.imageDims = [
      { width: 30000, height: 10 },
      { width: 30000, height: 10 }
    ]
    await run(makeFiles(2), {
      direction: 'horizontal',
      spacing: 0,
      backgroundColor: 'transparent',
      alignment: 'start'
    })
    const canvas = state.canvases[0]!
    expect(canvas.width).toBeLessThanOrEqual(MAX_CANVAS_SIDE)
    expect(canvas.height).toBeLessThanOrEqual(MAX_CANVAS_SIDE)
    expect(canvas.width * canvas.height).toBeLessThanOrEqual(MAX_CANVAS_AREA)
    expect(canvas.ctx.scale).toHaveBeenCalled()
  })
})

describe('combineEngine 错误路径与中止', () => {
  it('toBlob 前画布尺寸 ≤0 时拦截导出', async () => {
    state.freezeCanvasSizes = true
    state.imageDims = [{ width: 100, height: 100 }]
    await expect(
      run(makeFiles(1), {
        direction: 'vertical',
        spacing: 0,
        backgroundColor: 'transparent',
        alignment: 'start'
      })
    ).rejects.toThrow('拼接结果尺寸无效，无法导出')
    expect(state.canvases[0]!.toBlob).not.toHaveBeenCalled()
  })

  it('toBlob 返回 null → 抛错', async () => {
    state.toBlobPayload = null
    state.imageDims = [{ width: 100, height: 100 }]
    await expect(
      run(makeFiles(1), {
        direction: 'vertical',
        spacing: 0,
        backgroundColor: 'transparent',
        alignment: 'start'
      })
    ).rejects.toThrow('生成图片数据(Blob)失败')
  })

  it('Canvas 上下文获取失败 → 抛错', async () => {
    state.ctxNull = true
    state.imageDims = [{ width: 100, height: 100 }]
    await expect(
      run(makeFiles(1), {
        direction: 'vertical',
        spacing: 0,
        backgroundColor: 'transparent',
        alignment: 'start'
      })
    ).rejects.toThrow('无法初始化 Canvas 绘图上下文')
  })

  it('已中止 signal → AbortError 并回收所有 objectURL', async () => {
    state.imageDims = [
      { width: 100, height: 100 },
      { width: 100, height: 100 }
    ]
    const controller = new AbortController()
    controller.abort()
    await expect(
      run(makeFiles(2), {
        direction: 'vertical',
        spacing: 0,
        backgroundColor: 'transparent',
        signal: controller.signal,
        alignment: 'start'
      })
    ).rejects.toThrow('AbortError')
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  })
})
