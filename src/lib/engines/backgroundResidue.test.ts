import { describe, it, expect } from 'vitest'
import {
  collectBackgroundPalette,
  removeBackgroundResidue,
  type RgbaImage
} from './backgroundResidue'

const MAROON = [104, 44, 36] as const
const ORANGE = [255, 132, 76] as const
const GRAY = [119, 103, 103] as const

/** 按逐像素颜色/alpha 构造图像：RGBA 里 alpha 同时作为遮罩 alpha */
function build(
  width: number,
  height: number,
  pixel: (index: number) => { rgb: readonly [number, number, number]; alpha: number }
): { image: RgbaImage; alpha: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(width * height * 4)
  const alpha = new Uint8ClampedArray(width * height)
  for (let i = 0; i < width * height; i++) {
    const { rgb, alpha: a } = pixel(i)
    data[i * 4] = rgb[0]
    data[i * 4 + 1] = rgb[1]
    data[i * 4 + 2] = rgb[2]
    data[i * 4 + 3] = a
    alpha[i] = a
  }
  return { image: { data, width, height }, alpha }
}

describe('collectBackgroundPalette', () => {
  it('只从遮罩判为背景的像素取色，前景色不进调色板', () => {
    const { image, alpha } = build(4, 1, (i) =>
      i === 1 ? { rgb: ORANGE, alpha: 255 } : { rgb: MAROON, alpha: 0 }
    )
    const palette = collectBackgroundPalette(image, alpha)
    expect(palette.length).toBe(1)
    expect(palette[0]!.r).toBeCloseTo(MAROON[0], 0)
    expect(palette[0]!.g).toBeCloseTo(MAROON[1], 0)
  })

  it('出现次数太少的颜色视为噪声丢弃', () => {
    const { image, alpha } = build(40, 1, (i) => ({
      rgb: i === 3 ? [10, 120, 200] : MAROON,
      alpha: 0
    }))
    // 40 个背景像素，minShare 取 5% → 至少 8 个才保留
    const palette = collectBackgroundPalette(image, alpha, 0.05)
    expect(palette.length).toBe(1)
  })
})

describe('removeBackgroundResidue', () => {
  it('清掉贴边阴影条带，保留相邻的物体', () => {
    // 3 行 5 列：
    //   透明背景 / 橙色物体 / 暗红条带(与上方透明区相连) / 灰化混合线 / 透明
    // 条带不清掉的话，混合线也不该被独立判定为背景。
    const colors = [
      MAROON,
      MAROON,
      MAROON,
      MAROON,
      MAROON,
      ORANGE,
      MAROON,
      GRAY,
      MAROON,
      MAROON,
      MAROON,
      MAROON,
      MAROON,
      MAROON,
      MAROON
    ]
    const alphas = [0, 0, 0, 0, 0, 255, 255, 180, 0, 0, 0, 0, 0, 0, 0]
    const { image, alpha } = build(5, 3, (i) => ({
      rgb: colors[i]! as [number, number, number],
      alpha: alphas[i]!
    }))

    const cleaned = removeBackgroundResidue(alpha, image)

    expect(Array.from(cleaned)).toEqual([0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    // 入参不被修改，遮罩缓存才能复用
    expect(Array.from(alpha)).toEqual(alphas)
  })

  it('被两侧清除背景夹住的 1px 暗线也会清掉', () => {
    // 实测回归：残留块边界被模型压成一条不透明暗线 (118,20,19)，
    // 与墙面 Lab 差约 18，超过严格阈值；但它只有一像素宽且两侧都是背景。
    const LINE = [118, 20, 19] as const
    const { image, alpha } = build(5, 3, (i) => {
      const x = i % 5
      const y = Math.floor(i / 5)
      return {
        rgb: y === 1 && x === 2 ? LINE : MAROON,
        alpha: y === 1 && x > 0 && x < 4 ? 255 : 0
      }
    })
    const cleaned = removeBackgroundResidue(alpha, image)
    expect(Array.from(cleaned)).toEqual(new Array(15).fill(0))
  })

  it('只挨着原有透明区的半透明边缘不动', () => {
    // 半透明皮肤/物体抗锯齿边，颜色本身在背景调色板的放宽范围内，
    // 但它没有紧挨着「本次清除的背景块」，不能被顺带清掉。
    const { image, alpha } = build(3, 1, (i) =>
      i === 0 ? { rgb: MAROON, alpha: 0 } : { rgb: [150, 110, 100] as const, alpha: 150 }
    )
    const cleaned = removeBackgroundResidue(alpha, image)
    expect(Array.from(cleaned)).toEqual([0, 150, 150])
  })

  it('与背景在 Lab 空间相近的深橙色阴影不会被误删', () => {
    // 实测回归：袋身暗部 (150,60,50) 与墙面 (104,44,36) 的 Lab 差只有 17，
    // 用 Lab 阈值会整块啃掉袋身；RGB 距离 50 能把它和背景区分开。
    const SHADOW = [150, 60, 50] as const
    const { image, alpha } = build(3, 1, (i) =>
      i === 0 ? { rgb: MAROON, alpha: 0 } : { rgb: i === 1 ? SHADOW : ORANGE, alpha: 255 }
    )
    const cleaned = removeBackgroundResidue(alpha, image)
    expect(Array.from(cleaned)).toEqual([0, 255, 255])
  })

  it('被前景包围的同色区域不会误删', () => {
    // 5×5：外圈透明背景，内圈橙色物体，正中一块暗红
    const { image, alpha } = build(5, 5, (i) => {
      const x = i % 5
      const y = Math.floor(i / 5)
      const border = x === 0 || y === 0 || x === 4 || y === 4
      const center = i === 12
      return {
        rgb: center || border ? MAROON : ORANGE,
        alpha: border ? 0 : 255
      }
    })
    const cleaned = removeBackgroundResidue(alpha, image)
    expect(cleaned[12]).toBe(255)
    expect(cleaned[7]).toBe(255)
  })

  it('颜色与背景明显不同的前景边缘保持原样', () => {
    const { image, alpha } = build(4, 1, (i) =>
      i === 0 ? { rgb: MAROON, alpha: 0 } : { rgb: ORANGE, alpha: i === 1 ? 160 : 255 }
    )
    const cleaned = removeBackgroundResidue(alpha, image)
    expect(Array.from(cleaned)).toEqual([0, 160, 255, 255])
  })
})
