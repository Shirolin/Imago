import { describe, it, expect } from 'vitest'
import { refineMaskWithGuide } from './guidedMaskRefine'

/**
 * 交互式遮罩的引导精修回归测试。
 * 锁定三条契约：未知带外的 alpha 一律不动、均匀引导下线性过渡带保持原值、
 * 遮罩边缘与引导边缘错位时过渡带向引导边缘靠拢。
 */

function solidGuide(width: number, height: number, luma: number) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data.set([luma, luma, luma, 255], i * 4)
  }
  return data
}

function rowAlpha(values: number[]) {
  return Uint8ClampedArray.from(values)
}

describe('refineMaskWithGuide', () => {
  it('未知带外的实心前景与纯透明像素一个值都不改', () => {
    const alpha = rowAlpha([0, 0, 255, 255, 0])
    const out = refineMaskWithGuide(alpha, solidGuide(5, 1, 96), 5, 1)
    expect(Array.from(out)).toEqual([0, 0, 255, 255, 0])
  })

  it('均匀引导下过渡带保持单调且不被截断', () => {
    const alpha = rowAlpha([0, 0, 64, 128, 192, 255, 255])
    const out = refineMaskWithGuide(alpha, solidGuide(7, 1, 128), 7, 1)
    const band = Array.from(out.slice(2, 5))
    expect(band.every((v) => v > 0 && v < 255)).toBe(true)
    expect(band[0]! <= band[1]! && band[1]! <= band[2]!).toBe(true)
  })

  it('引导边缘领先遮罩边缘时，过渡带向引导边缘靠拢', () => {
    // 引导图在 x=4 从黑跳到白，遮罩在 x=6 才跳；x=5 是原本很淡的过渡像素
    const guide = new Uint8ClampedArray(9 * 4)
    for (let x = 0; x < 9; x++) {
      const luma = x < 4 ? 0 : 255
      guide.set([luma, luma, luma, 255], x * 4)
    }
    const alpha = rowAlpha([0, 0, 0, 0, 0, 26, 255, 255, 255])
    const out = refineMaskWithGuide(alpha, guide, 9, 1)
    // x=5 紧贴引导图的前景侧：精修后应该明显更接近前景
    expect(out[5]!).toBeGreaterThan(26)
    expect(out[5]!).toBeLessThan(255)
    // 离开过渡带的像素仍是纯前景/纯背景
    expect(out[0]).toBe(0)
    expect(out[8]).toBe(255)
  })
})
