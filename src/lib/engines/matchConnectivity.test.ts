import { describe, it, expect } from 'vitest'
import { processMatchPixels } from './matchWorker'

/**
 * 色值模式的连通性约束回归测试。
 * 白衬衫配白墙：仅按色距会把衣服内部一起抠掉；
 * 打开「仅移除连通背景」后，只有与图像边界连通的白色区域才移除。
 */

const WHITE = { r: 255, g: 255, b: 255 }
const SUBJECT = [120, 80, 50]
const SIZE = 5

function makeImage(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const inner = x >= 1 && x <= 3 && y >= 1 && y <= 3
      const center = x === 2 && y === 2
      const rgb = inner && !center ? SUBJECT : [255, 255, 255]
      data.set([rgb[0]!, rgb[1]!, rgb[2]!, 255], (y * SIZE + x) * 4)
    }
  }
  return data
}

const alphaAt = (data: Uint8ClampedArray, x: number, y: number) => data[(y * SIZE + x) * 4 + 3]!

describe('processMatchPixels 连通性约束', () => {
  it('默认按色距移除，封闭在前景内部的同色区域也会被抠掉', () => {
    const data = makeImage()
    processMatchPixels(data, WHITE, 0.15, 0.05)
    expect(alphaAt(data, 2, 2)).toBe(0)
  })

  it('开启连通性后，被前景包围的同色区域保留', () => {
    const data = makeImage()
    processMatchPixels(data, WHITE, 0.15, 0.05, undefined, { width: SIZE, height: SIZE })
    expect(alphaAt(data, 2, 2)).toBe(255)
    // 与边界连通的背景仍然移除
    expect(alphaAt(data, 0, 0)).toBe(0)
  })
})
