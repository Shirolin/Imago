import { describe, it, expect } from 'vitest'
import {
  MAX_MOLD_SIDE,
  MOLD_PRESETS,
  DEFAULT_MOLD_SIDE,
  MAX_BASKET,
  normalizeMold,
  normalizeMoldSize,
  isOutOfBounds,
  containMold,
  buildStampBaseName,
  needsOpaqueFill,
  canAddToBasket,
  uniqueZipName,
  resizeMold
} from './moldCut'

describe('moldCut 纯逻辑', () => {
  it('预设含 32 且默认 32', () => {
    expect(MOLD_PRESETS).toContain(32)
    expect(DEFAULT_MOLD_SIDE).toBe(32)
  })

  it('尺寸取整并夹紧到合法区间', () => {
    expect(normalizeMoldSize(32.6, 31.4)).toEqual({ w: 33, h: 31 })
    expect(normalizeMoldSize(0, -5)).toEqual({ w: 1, h: 1 })
  })

  it('坐标取整，允许负值（出界补透明）', () => {
    expect(normalizeMold({ x: 10.6, y: -3.2, w: 32, h: 32 })).toEqual({
      x: 11,
      y: -3,
      w: 32,
      h: 32
    })
  })

  it('出界判定：内/贴边/部分出界', () => {
    expect(isOutOfBounds({ x: 0, y: 0, w: 32, h: 32 }, 100, 100)).toBe(false)
    expect(isOutOfBounds({ x: 68, y: 68, w: 32, h: 32 }, 100, 100)).toBe(false)
    expect(isOutOfBounds({ x: 69, y: 0, w: 32, h: 32 }, 100, 100)).toBe(true)
    expect(isOutOfBounds({ x: -1, y: 0, w: 32, h: 32 }, 100, 100)).toBe(true)
  })

  it('拖拽收容：允许出界但不许彻底丢出视野', () => {
    const kept = containMold({ x: -1000, y: 50, w: 32, h: 32 }, 200, 200)
    expect(kept.x).toBe(8 - 32)
    expect(kept.y).toBe(50)
    const kept2 = containMold({ x: 1000, y: 1000, w: 32, h: 32 }, 200, 200)
    expect(kept2.x).toBe(200 - 8)
    expect(kept2.y).toBe(200 - 8)
  })

  it('命名规则：{原名}_{x}_{y}_{w}x{h}，去扩展名', () => {
    expect(buildStampBaseName('sprite.png', { x: 128, y: 64, w: 32, h: 32 })).toBe(
      'sprite_128_64_32x32'
    )
    expect(buildStampBaseName('a.b.c.webp', { x: 0, y: 0, w: 16, h: 16 })).toBe('a.b.c_0_0_16x16')
  })

  it('仅 JPEG 系需要出界白底填充', () => {
    expect(needsOpaqueFill('image/jpeg', 'image/png')).toBe(true)
    expect(needsOpaqueFill('original', 'image/jpeg')).toBe(true)
    expect(needsOpaqueFill('original', 'image/png')).toBe(false)
    expect(needsOpaqueFill('image/png', 'image/jpeg')).toBe(false)
    expect(needsOpaqueFill('image/webp', 'image/jpeg')).toBe(false)
  })

  it('收集篮上限 100：99 可加、100 拒绝', () => {
    expect(canAddToBasket(99)).toBe(true)
    expect(canAddToBasket(MAX_BASKET)).toBe(false)
  })

  it('尺寸钳制到 MAX_MOLD_SIDE，非 finite 回退默认', () => {
    expect(normalizeMoldSize(99999, 50)).toEqual({ w: MAX_MOLD_SIDE, h: 50 })
    // NaN 回退默认；+Infinity 按钳制收敛到上限
    expect(normalizeMoldSize(NaN, NaN)).toEqual({ w: 32, h: 32 })
    expect(normalizeMoldSize(NaN, Infinity)).toEqual({ w: 32, h: MAX_MOLD_SIDE })
    expect(normalizeMold({ x: NaN, y: 0, w: 32, h: 32 }).x).toBe(0)
  })

  it('手柄缩放：边角换算与最小钳制', () => {
    expect(resizeMold({ x: 0, y: 0, w: 32, h: 32 }, 'se', 5, 10)).toEqual({
      x: 0,
      y: 0,
      w: 37,
      h: 42
    })
    expect(resizeMold({ x: 10, y: 10, w: 32, h: 32 }, 'nw', 4, 6)).toEqual({
      x: 14,
      y: 16,
      w: 28,
      h: 26
    })
    // 西边拉过头：宽收至 1，右沿不动
    expect(resizeMold({ x: 0, y: 0, w: 32, h: 32 }, 'w', 100, 0)).toEqual({
      x: 31,
      y: 0,
      w: 1,
      h: 32
    })
    // 出界允许：西边往负方向拉
    expect(resizeMold({ x: 0, y: 0, w: 32, h: 32 }, 'w', -5, 0).x).toBe(-5)
    // 角手柄锁比：宽主导时高跟随
    expect(resizeMold({ x: 0, y: 0, w: 32, h: 16 }, 'se', 16, 0, true)).toEqual({
      x: 0,
      y: 0,
      w: 48,
      h: 24
    })
  })

  it('ZIP 同名去重：同坐标连盖不互相覆盖', () => {
    const used = new Set<string>()
    expect(uniqueZipName(used, 's_0_0_32x32.png')).toBe('s_0_0_32x32.png')
    expect(uniqueZipName(used, 's_0_0_32x32.png')).toBe('s_0_0_32x32 (2).png')
    expect(uniqueZipName(used, 's_0_0_32x32.png')).toBe('s_0_0_32x32 (3).png')
  })
})
