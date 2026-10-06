import { describe, it, expect } from 'vitest'
import {
  sampleBackground,
  isBackground,
  boundsOfNonBackground,
  downsampleSize,
  type Rgba
} from './contentBounds'

/**
 * 内容边界探测的算法验证。
 *
 * 原先内联在 CropBox.vue 的 handleImageLoad 里（canvas 取样 + 像素扫描），
 * 零测试覆盖。canvas 部分必须留在组件（需要真实 HTMLImageElement），
 * 这里的纯算法用构造数据直接验证。
 */

/** 构造 w×h 的 RGBA 数据，fill 填满，painter 逐像素覆盖 */
function makeImage(
  w: number,
  h: number,
  fill: Rgba,
  painter?: (x: number, y: number) => Rgba | null
) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = painter?.(x, y) ?? fill
      const i = (y * w + x) * 4
      data[i] = p.r
      data[i + 1] = p.g
      data[i + 2] = p.b
      data[i + 3] = p.a
    }
  }
  return data
}

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 255 }
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 255 }
const TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 }

describe('downsampleSize', () => {
  it('不超过上限时原样返回', () => {
    expect(downsampleSize(800, 600, 1024)).toEqual({ w: 800, h: 600 })
  })

  it('宽大于高时按宽缩放', () => {
    expect(downsampleSize(2000, 1000, 1024)).toEqual({ w: 1024, h: 512 })
  })

  it('高大于宽时按高缩放', () => {
    expect(downsampleSize(1000, 2000, 1024)).toEqual({ w: 512, h: 1024 })
  })

  it('恰好等于上限不变', () => {
    expect(downsampleSize(1024, 1024, 1024)).toEqual({ w: 1024, h: 1024 })
  })
})

describe('sampleBackground', () => {
  it('纯色图的背景即该色', () => {
    const data = makeImage(20, 20, BLACK)
    expect(sampleBackground(data, 20, 20)).toEqual(BLACK)
  })

  it('中位数抵抗前景污染（首行一半被前景覆盖）', () => {
    // 首行左半黑右半白，末行与主体全黑 → 背景应为黑
    const data = makeImage(20, 20, BLACK, (x, y) => (y === 0 && x >= 10 ? WHITE : null))
    expect(sampleBackground(data, 20, 20)).toEqual(BLACK)
  })

  it('透明背景的 alpha 中位数为 0', () => {
    const data = makeImage(20, 20, TRANSPARENT)
    expect(sampleBackground(data, 20, 20).a).toBe(0)
  })
})

describe('isBackground', () => {
  it('背景透明时只比 alpha', () => {
    const bg: Rgba = { r: 255, g: 255, b: 255, a: 0 }
    // 颜色差异巨大但 alpha 也低 → 仍算背景
    expect(isBackground({ r: 0, g: 0, b: 0, a: 10 }, bg)).toBe(true)
    expect(isBackground({ r: 0, g: 0, b: 0, a: 200 }, bg)).toBe(false)
  })

  it('背景不透明时同时比颜色与 alpha', () => {
    expect(isBackground(WHITE, WHITE)).toBe(true)
    // 颜色差 30（< 40）仍算背景
    expect(isBackground({ r: 225, g: 255, b: 255, a: 255 }, WHITE)).toBe(true)
    // 颜色差 60 超阈值
    expect(isBackground({ r: 195, g: 255, b: 255, a: 255 }, WHITE)).toBe(false)
    // alpha 差 40 超阈值（严格小于）
    expect(isBackground({ r: 255, g: 255, b: 255, a: 215 }, WHITE)).toBe(false)
  })
})

describe('boundsOfNonBackground', () => {
  it('纯色图无内容 → null（调用方保持原选区）', () => {
    const data = makeImage(20, 20, WHITE)
    expect(boundsOfNonBackground(data, 20, 20)).toBeNull()
  })

  it('内容居中 → 百分比包围盒正确', () => {
    // 20×20 白底，(8,6)-(11,9) 为黑 → x=8/20=40%, w=4/20=20%
    const data = makeImage(20, 20, WHITE, (x, y) =>
      x >= 8 && x <= 11 && y >= 6 && y <= 9 ? BLACK : null
    )
    const b = boundsOfNonBackground(data, 20, 20)
    expect(b).not.toBeNull()
    expect(b!.x).toBeCloseTo(40)
    expect(b!.y).toBeCloseTo(30)
    expect(b!.w).toBeCloseTo(20)
    expect(b!.h).toBeCloseTo(20)
  })

  it('内容贴左上角', () => {
    const data = makeImage(10, 10, WHITE, (x, y) => (x < 2 && y < 3 ? BLACK : null))
    const b = boundsOfNonBackground(data, 10, 10)
    expect(b).toEqual({ x: 0, y: 0, w: 20, h: 30 })
  })

  it('透明背景 + 全不透明内容 → 0,0,100,100', () => {
    // 采样首末两行得到全不透明黑，bg.a=255 → 走「比颜色」分支，
    // 需显式给出透明背景才落入「只比 alpha」分支
    const data = makeImage(10, 10, BLACK)
    const b = boundsOfNonBackground(data, 10, 10, { r: 0, g: 0, b: 0, a: 0 })
    expect(b).toEqual({ x: 0, y: 0, w: 100, h: 100 })
  })

  it('透明背景下半透明像素算背景、完全不透明才算内容', () => {
    const bg: Rgba = { r: 0, g: 0, b: 0, a: 0 }
    expect(isBackground({ r: 0, g: 0, b: 0, a: 100 }, bg)).toBe(true)
    expect(isBackground({ r: 0, g: 0, b: 0, a: 255 }, bg)).toBe(false)
  })

  it('可传入外部背景色（供测试与特殊场景）', () => {
    const data = makeImage(10, 10, WHITE)
    // 把背景强行指定为黑，则白色像素全算内容
    const b = boundsOfNonBackground(data, 10, 10, BLACK)
    expect(b).toEqual({ x: 0, y: 0, w: 100, h: 100 })
  })

  it('单个像素内容也能被检出（+1 宽度修正）', () => {
    const data = makeImage(10, 10, WHITE, (x, y) => (x === 5 && y === 5 ? BLACK : null))
    const b = boundsOfNonBackground(data, 10, 10)
    expect(b).toEqual({ x: 50, y: 50, w: 10, h: 10 })
  })
})
