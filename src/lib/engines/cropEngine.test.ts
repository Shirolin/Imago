import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { cropEngine } from './cropEngine'

/**
 * cropEngine 回归测试（P0-1 显示端 round 与引擎 round 一致 / 旋转坐标帧）
 *
 * Mock 策略：jsdom 无 canvas 渲染实现，用 document.createElement('canvas') spy 返回
 * 手写 MockCanvas（getContext → MockCtx 捕获 drawImage/translate/rotate/scale/fillRect，
 * toBlob 直接回调 Blob）；global.Image 替换为可配置尺寸的桩，由测试手动触发 onload/onerror
 * （确定性驱动，不使用真实定时器）。
 */

const DEFAULT_BLOB = Symbol('default')

type MockFn = Mock

interface MockCtx {
  drawImage: MockFn
  translate: MockFn
  rotate: MockFn
  scale: MockFn
  fillRect: MockFn
  getImageData: MockFn
  putImageData: MockFn
  fillStyle: string
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

interface MockImageInstance {
  width: number
  height: number
  srcValue: string
  onload: (() => void) | null
  onerror: (() => void) | null
}

const state = {
  imageProps: { width: 640, height: 360 },
  images: [] as MockImageInstance[],
  firedCount: 0,
  canvases: [] as MockCanvas[],
  toBlobPayload: undefined as unknown as Blob | null | typeof DEFAULT_BLOB,
  ctxNull: false
}

class MockImage implements MockImageInstance {
  width: number
  height: number
  srcValue = ''
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    this.width = state.imageProps.width
    this.height = state.imageProps.height
    state.images.push(this)
  }
  set src(v: string) {
    this.srcValue = v
  }
}

function makeCtx(): MockCtx {
  return {
    drawImage: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4)
    })),
    putImageData: vi.fn(),
    fillStyle: '',
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

/** 手动触发自上次调用以来新建 Image 的 onload（无真实定时器） */
function fireImages() {
  for (let i = state.firedCount; i < state.images.length; i++) {
    state.images[i]!.onload?.()
  }
  state.firedCount = state.images.length
}

beforeEach(() => {
  state.imageProps = { width: 640, height: 360 }
  state.images = []
  state.firedCount = 0
  state.canvases = []
  state.toBlobPayload = DEFAULT_BLOB
  state.ctxNull = false

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

function makeFile(name = 'a.png', type = 'image/png'): File {
  return new File(['x'], name, { type })
}

describe('cropEngine 1px 取整回归', () => {
  it('整数值全幅裁剪输出精确 640×360（修复前终点 floor 会少 1px）', async () => {
    state.imageProps = { width: 640, height: 360 }
    const promise = cropEngine(makeFile(), {
      usePercentage: true,
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
    fireImages()
    const result = await promise
    expect(result.width).toBe(640)
    expect(result.height).toBe(360)
    // 最终画布尺寸与显示端 pxCoords 的 round 规则一致
    expect(state.canvases[1]!.width).toBe(640)
    expect(state.canvases[1]!.height).toBe(360)
  })

  it('三分构图三块宽度合计恰为 640（round 起点 + round 终点取整）', async () => {
    state.imageProps = { width: 640, height: 360 }
    const parts = [
      { x: 0, w: 33.33 },
      { x: 33.33, w: 33.34 },
      { x: 66.67, w: 33.33 }
    ]
    const widths: number[] = []
    const heights: number[] = []
    for (const p of parts) {
      const promise = cropEngine(makeFile(), {
        usePercentage: true,
        x: p.x,
        y: 0,
        width: p.w,
        height: 33.33
      })
      fireImages()
      const r = await promise
      widths.push(r.width!)
      heights.push(r.height!)
    }
    // 213 + 214 + 213 = 640，不再出现 639 的缺口
    expect(widths).toEqual([213, 214, 213])
    expect(widths.reduce((a, b) => a + b, 0)).toBe(640)
    expect(heights).toEqual([120, 120, 120])
  })

  it('小数像素坐标：round 起点、round(终点)-round(起点) 不丢像素', async () => {
    state.imageProps = { width: 100, height: 100 }
    const promise = cropEngine(makeFile(), { x: 10.4, y: 10.6, width: 50, height: 50 })
    fireImages()
    const result = await promise
    expect(result.width).toBe(50) // round(60.4)-10 = 50
    expect(result.height).toBe(50) // round(60.6)-11 = 50
    // 负偏移 = -finalX / -finalY
    expect(state.canvases[1]!.ctx.drawImage).toHaveBeenCalledWith(state.canvases[0], -10, -11)
  })
})

describe('cropEngine 旋转坐标帧', () => {
  it('旋转 90°：工作画布宽高交换（rotatedWidth = 原高）', async () => {
    state.imageProps = { width: 640, height: 360 }
    const promise = cropEngine(makeFile(), { rotation: 90 })
    fireImages()
    await promise
    const work = state.canvases[0]!
    expect(work.width).toBe(360)
    expect(work.height).toBe(640)
    expect(work.ctx.rotate).toHaveBeenCalledWith((90 * Math.PI) / 180)
  })

  it('旋转 270° 同样交换宽高；旋转 180° 不交换', async () => {
    state.imageProps = { width: 640, height: 360 }
    let promise = cropEngine(makeFile(), { rotation: 270 })
    fireImages()
    await promise
    expect(state.canvases[0]!.width).toBe(360)
    expect(state.canvases[0]!.height).toBe(640)

    state.canvases = []
    promise = cropEngine(makeFile(), { rotation: 180 })
    fireImages()
    await promise
    expect(state.canvases[0]!.width).toBe(640)
    expect(state.canvases[0]!.height).toBe(360)
  })

  it('旋转 90° + 百分比坐标按旋转帧换算（x=50% → 180px）', async () => {
    state.imageProps = { width: 640, height: 360 }
    const promise = cropEngine(makeFile(), {
      rotation: 90,
      usePercentage: true,
      x: 50,
      y: 0,
      width: 100,
      height: 100
    })
    fireImages()
    await promise
    const finalCanvas = state.canvases[1]!
    expect(finalCanvas.width).toBe(360)
    expect(finalCanvas.height).toBe(640)
    const [img, offsetX, offsetY] = finalCanvas.ctx.drawImage.mock.calls[0]!
    expect(img).toBe(state.canvases[0])
    expect(offsetX).toBe(-180) // 50% × 360（旋转帧宽）= 180
    expect(offsetY === 0).toBe(true) // y=0 → -0 与 0 等价
  })
})

describe('cropEngine 边框/填充/镜像', () => {
  it('trimPx 向四个方向内缩裁剪', async () => {
    state.imageProps = { width: 100, height: 100 }
    const promise = cropEngine(makeFile(), {
      x: 10,
      y: 10,
      width: 100,
      height: 100,
      trimPx: { top: 5, bottom: 5, left: 5, right: 5 }
    })
    fireImages()
    const result = await promise
    expect(result.width).toBe(90)
    expect(result.height).toBe(90)
    expect(state.canvases[1]!.ctx.drawImage).toHaveBeenCalledWith(state.canvases[0], -15, -15)
  })

  it('fillColor 填充底层；transparent 不填充', async () => {
    state.imageProps = { width: 100, height: 100 }
    let promise = cropEngine(makeFile(), { fillColor: '#ff0000' })
    fireImages()
    await promise
    const ctx = state.canvases[1]!.ctx
    expect(ctx.fillStyle).toBe('#ff0000')
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100)

    state.canvases = []
    promise = cropEngine(makeFile(), { fillColor: 'transparent' })
    fireImages()
    await promise
    expect(state.canvases[1]!.ctx.fillRect).not.toHaveBeenCalled()
  })

  it('flipH/flipV 传入镜像变换', async () => {
    state.imageProps = { width: 100, height: 100 }
    const promise = cropEngine(makeFile(), { flipH: true, flipV: true })
    fireImages()
    await promise
    expect(state.canvases[0]!.ctx.scale).toHaveBeenCalledWith(-1, -1)
  })
})

describe('cropEngine 错误路径与中止', () => {
  it('toBlob 返回 null 时拒绝', async () => {
    state.toBlobPayload = null
    const promise = cropEngine(makeFile(), {})
    fireImages()
    await expect(promise).rejects.toThrow('Canvas toBlob failed')
  })

  it('getContext 返回 null 时拒绝', async () => {
    state.ctxNull = true
    const promise = cropEngine(makeFile(), {})
    fireImages()
    await expect(promise).rejects.toThrow('Failed to get canvas context')
  })

  it('图片加载失败时拒绝并回收 URL', async () => {
    const promise = cropEngine(makeFile(), {})
    state.images[0]!.onerror?.()
    await expect(promise).rejects.toThrow('Failed to load image')
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('abort 信号中止任务并清空 img.src', async () => {
    const controller = new AbortController()
    const promise = cropEngine(makeFile(), { signal: controller.signal })
    controller.abort()
    await expect(promise).rejects.toThrow('Task aborted')
    expect(state.images[0]!.srcValue).toBe('')
  })
})

describe('cropEngine 元数据保留', () => {
  it('preserveExif JPEG：合并 APP1 块后输出', async () => {
    state.imageProps = { width: 100, height: 100 }
    const file = new File(
      [new Uint8Array([0xff, 0xe1, 0x00, 0x08, 0x11, 0x22, 0x33, 0x44, 0x55])],
      'a.jpg',
      { type: 'image/jpeg' }
    )
    state.toBlobPayload = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], {
      type: 'image/jpeg'
    })
    const promise = cropEngine(file, { preserveExif: true, format: 'image/jpeg' })
    fireImages()
    const result = await promise
    expect(result.blob!.type).toBe('image/jpeg')
    // SOI(2) + APP1 块(9) + [FF DB](2) = 13
    expect(result.size).toBe(13)
  })
})
