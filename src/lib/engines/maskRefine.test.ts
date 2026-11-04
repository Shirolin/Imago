import { describe, expect, it } from 'vitest'
import { refineMaskAlpha } from './maskRefine'

describe('refineMaskAlpha', () => {
  it('默认参数不改变遮罩', () => {
    for (const alpha of [0, 64, 128, 200, 255]) {
      expect(refineMaskAlpha(alpha, 0, 0)).toBe(alpha)
    }
  })

  it('判定强度围绕 0.5 拉开对比度，且不移动轮廓', () => {
    expect(refineMaskAlpha(128, 1, 0)).toBe(130)
    expect(refineMaskAlpha(64, 1, 0)).toBeLessThan(64)
    expect(refineMaskAlpha(192, 1, 0)).toBeGreaterThan(192)
  })

  it('边缘收缩把软边向内压，同时保留实心内部', () => {
    expect(refineMaskAlpha(255, 0, 0.5)).toBe(255)
    expect(refineMaskAlpha(127, 0, 0.5)).toBe(0)
    expect(refineMaskAlpha(192, 0, 0.5)).toBe(129)
  })

  it('参数越界时截断到 0-255', () => {
    expect(refineMaskAlpha(255, 2, 0)).toBe(255)
    expect(refineMaskAlpha(0, 2, 0)).toBe(0)
    expect(refineMaskAlpha(128, -1, 0)).toBe(128)
  })
})
