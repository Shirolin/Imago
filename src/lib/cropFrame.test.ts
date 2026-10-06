import { describe, it, expect } from 'vitest'
import {
  toRotatedFrame,
  fromRotatedFrame,
  rotatedDims,
  toPixelCoords,
  clampCropPercent,
  isCropBoundsValid,
  type RotRect
} from './cropFrame'

/**
 * 坐标帧变换的表驱动验证。
 *
 * 这段逻辑原先内联在 CropView.vue，因 <script setup> 语法锁住而完全不可测。
 * 坐标变换是最容易出 1px 错误的地方：引擎端（cropEngine 的 round 规则）
 * 与显示端必须一致，否则旋转后输出区域与选区错位。
 */

const W = 800
const H = 600

const ROTATIONS = [0, 90, 180, 270, -90, 450] as const
const FLIPS = [
  { flipH: false, flipV: false },
  { flipH: true, flipV: false },
  { flipH: false, flipV: true },
  { flipH: true, flipV: true }
] as const

const CROP: RotRect = { x: 10, y: 20, w: 50, h: 40 }

describe('rotatedDims', () => {
  it('0/180 保持原尺寸', () => {
    expect(rotatedDims(W, H, 0)).toEqual({ w: W, h: H })
    expect(rotatedDims(W, H, 180)).toEqual({ w: W, h: H })
  })

  it('90/270 宽高互换', () => {
    expect(rotatedDims(W, H, 90)).toEqual({ w: H, h: W })
    expect(rotatedDims(W, H, 270)).toEqual({ w: H, h: W })
  })

  it('负旋转与超 360 归一到 [0,360)', () => {
    // -90 应视作 270，450 应视作 90
    expect(rotatedDims(W, H, -90)).toEqual(rotatedDims(W, H, 270))
    expect(rotatedDims(W, H, 450)).toEqual(rotatedDims(W, H, 90))
  })

  it('尺寸未知时返回 0', () => {
    expect(rotatedDims(undefined, H, 90)).toEqual({ w: 0, h: 0 })
    expect(rotatedDims(W, 0, 0)).toEqual({ w: 0, h: 0 })
  })
})

describe('toRotatedFrame / fromRotatedFrame 往返一致性', () => {
  // 核心不变量：局部百分比 → 旋转帧像素 → 局部百分比 必须回到原点。
  // 这条锁住了 4 种旋转 × 4 种翻转的全部组合，而不必逐个手算期望值。
  it.each(ROTATIONS.flatMap((rotation) => FLIPS.map((f) => [rotation, f] as const)))(
    'rotation=%i flipH=%s flipV=%s 往返回到原点',
    (rotation, { flipH, flipV }) => {
      const pixels = toRotatedFrame(CROP, W, H, rotation, flipH, flipV)
      const back = fromRotatedFrame(pixels, W, H, rotation, flipH, flipV)
      expect(back.x).toBeCloseTo(CROP.x, 6)
      expect(back.y).toBeCloseTo(CROP.y, 6)
      expect(back.w).toBeCloseTo(CROP.w, 6)
      expect(back.h).toBeCloseTo(CROP.h, 6)
    }
  )
})

describe('toRotatedFrame 具体映射', () => {
  it('0° 无翻转 = 原位', () => {
    const r = toRotatedFrame(CROP, W, H, 0, false, false)
    expect(r).toEqual({ x: 80, y: 120, w: 400, h: 240 })
  })

  it('90°：X = H − oy − ph、Y = ox（推导见文件头注释）', () => {
    const r = toRotatedFrame(CROP, W, H, 90, false, false)
    // oy=120, ph=240 → X = 600-120-240 = 240；ox=80 → Y = 80
    expect(r).toEqual({ x: 240, y: 80, w: 240, h: 400 })
  })

  it('180°：双轴镜像', () => {
    const r = toRotatedFrame(CROP, W, H, 180, false, false)
    // X = 800-80-400 = 320；Y = 600-120-240 = 240
    expect(r).toEqual({ x: 320, y: 240, w: 400, h: 240 })
  })

  it('270°：X = oy、Y = W − ox − ow', () => {
    const r = toRotatedFrame(CROP, W, H, 270, false, false)
    expect(r).toEqual({ x: 120, y: 320, w: 240, h: 400 })
  })

  it('旋转后矩形仍落在旋转画布内', () => {
    // 全画布裁剪在任意旋转/翻转下都应恰好覆盖旋转后的整块画布
    const full: RotRect = { x: 0, y: 0, w: 100, h: 100 }
    for (const rotation of ROTATIONS) {
      for (const { flipH, flipV } of FLIPS) {
        const dims = rotatedDims(W, H, rotation)
        const r = toRotatedFrame(full, W, H, rotation, flipH, flipV)
        expect(isCropBoundsValid(r, dims.w, dims.h)).toBe(true)
      }
    }
  })
})

describe('toPixelCoords', () => {
  it('四边取整，与引擎端 round 规则一致', () => {
    // 选一个会产生小数的情形：33.33% of 800 = 266.64
    const r = toPixelCoords({ x: 33.33, y: 33.33, w: 33.33, h: 33.33 }, W, H, 0, false, false)
    expect(Number.isInteger(r.x)).toBe(true)
    expect(Number.isInteger(r.y)).toBe(true)
    expect(Number.isInteger(r.w)).toBe(true)
    expect(Number.isInteger(r.h)).toBe(true)
  })

  it('全画布裁剪得到完整画布尺寸', () => {
    const r = toPixelCoords({ x: 0, y: 0, w: 100, h: 100 }, W, H, 0, false, false)
    expect(r).toEqual({ x: 0, y: 0, w: W, h: H })
  })
})

describe('clampCropPercent', () => {
  it('位置钳制到 [-50, 150]，尺寸钳制到 [0.5, 200]', () => {
    const r = clampCropPercent({ x: -999, y: 999, w: 0, h: 9999 })
    expect(r.x).toBe(-50)
    expect(r.y).toBe(150)
    expect(r.w).toBe(0.5)
    expect(r.h).toBe(200)
  })

  it('合法值原样保留（保留 4 位小数）', () => {
    expect(clampCropPercent({ x: 10.123456, y: 20, w: 50, h: 40 })).toEqual({
      x: 10.1235,
      y: 20,
      w: 50,
      h: 40
    })
  })
})

describe('isCropBoundsValid', () => {
  it('画布尺寸未知时视为合法（此时尚未选定图片）', () => {
    expect(isCropBoundsValid({ x: -100, y: -100, w: 1, h: 1 }, 0, 0)).toBe(true)
  })

  it('越界（含等号边界）判定', () => {
    expect(isCropBoundsValid({ x: 0, y: 0, w: W, h: H }, W, H)).toBe(true)
    expect(isCropBoundsValid({ x: -1, y: 0, w: 10, h: 10 }, W, H)).toBe(false)
    expect(isCropBoundsValid({ x: 0, y: -1, w: 10, h: 10 }, W, H)).toBe(false)
    expect(isCropBoundsValid({ x: W - 5, y: 0, w: 10, h: 10 }, W, H)).toBe(false)
    expect(isCropBoundsValid({ x: 0, y: 0, w: 0, h: 10 }, W, H)).toBe(false)
  })

  it('尺寸不足 1px 视为非法（引擎只会产出 1px 垃圾）', () => {
    expect(isCropBoundsValid({ x: 0, y: 0, w: 0.5, h: 10 }, W, H)).toBe(false)
    expect(isCropBoundsValid({ x: 0, y: 0, w: 10, h: 0.9 }, W, H)).toBe(false)
  })
})
