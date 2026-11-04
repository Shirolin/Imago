import { describe, it, expect } from 'vitest'
import { computeLetterbox, cropMaskAlpha } from './letterbox'

const SIZE = 1024

describe('computeLetterbox', () => {
  it('宽图：内容贴满宽度，上下留白居中', () => {
    expect(computeLetterbox(1200, 630, SIZE)).toEqual({ x: 0, y: 243, width: 1024, height: 538 })
  })

  it('竖图：内容贴满高度，左右留白居中', () => {
    expect(computeLetterbox(600, 1200, SIZE)).toEqual({ x: 256, y: 0, width: 512, height: 1024 })
  })

  it('正方形与小于模型尺寸的图都铺满内容区，不产生留白', () => {
    expect(computeLetterbox(500, 500, SIZE)).toEqual({ x: 0, y: 0, width: 1024, height: 1024 })
  })
})

describe('cropMaskAlpha', () => {
  it('按内容矩形裁剪，行与行之间不串位', () => {
    // 4×4 遮罩，内容区是中间的 2×2
    const alpha = Uint8ClampedArray.from({ length: 16 }, (_, i) => i)
    const cropped = cropMaskAlpha(alpha, 4, 4, { x: 1, y: 1, width: 2, height: 2 }, 4)
    expect(cropped.width).toBe(2)
    expect(cropped.height).toBe(2)
    expect(Array.from(cropped.alpha)).toEqual([5, 6, 9, 10])
  })

  it('内容区等于整张遮罩时原样返回，不复制', () => {
    const alpha = Uint8ClampedArray.from({ length: 4 }, (_, i) => i)
    const cropped = cropMaskAlpha(alpha, 2, 2, { x: 0, y: 0, width: 2, height: 2 }, 2)
    expect(cropped.alpha).toBe(alpha)
  })
})
