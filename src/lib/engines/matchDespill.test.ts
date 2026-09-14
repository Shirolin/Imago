import { describe, it, expect } from 'vitest'
import { processMatchPixels } from './matchWorker'

/**
 * 纯色提取（match 模式）绿边回归测试。
 * 旧管线只算 alpha 不改 RGB：边缘过渡像素的不透明度被抠掉后，混进 RGB 的 key 色仍留在像素里，
 * 黑底下即绿色镶边。这里锁定三条契约：全透与远主体像素 RGB 原样、边缘过渡像素去污染压掉绿分量、
 * 中性幕（白）key 完全 noop。
 */

const GREEN = { r: 0, g: 255, b: 0 }
const WHITE = { r: 255, g: 255, b: 255 }

// 一行 5 像素：绿幕 / 边缘过渡(约 30% 主体) / 50% 混色 / 主体棕 / 主体高光
const ROW = [
  [0, 255, 0],
  [45, 212, 21],
  [75, 183, 35],
  [150, 110, 70],
  [235, 196, 120]
]

const KEY_PX = 0
const FRINGE_PX = 1
const HALF_MIX_PX = 2
const SUBJECT_PX = 3
const HIGHLIGHT_PX = 4

const TOLERANCE = 0.15
const FEATHER = 0.05

function makeRow(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(ROW.length * 4)
  ROW.forEach((px, i) => {
    data.set([px[0]!, px[1]!, px[2]!, 255], i * 4)
  })
  return data
}

function readPx(data: Uint8ClampedArray, index: number) {
  const i = index * 4
  return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, a: data[i + 3]! }
}

/** 绿量：绿分量超出 R/B 均值的部分，即黑底下看到的绿色镶边强度 */
function greenExcess(px: { r: number; g: number; b: number }) {
  return px.g - (px.r + px.b) / 2
}

describe('processMatchPixels 纯色提取去绿边', () => {
  it('绿幕像素全透，RGB 原样保留', () => {
    const data = makeRow()
    processMatchPixels(data, GREEN, TOLERANCE, FEATHER)

    expect(readPx(data, KEY_PX)).toEqual({ r: 0, g: 255, b: 0, a: 0 })
  })

  it('远离 key 的主体与高光像素 RGB 一个分量都不改', () => {
    const data = makeRow()
    processMatchPixels(data, GREEN, TOLERANCE, FEATHER)

    expect(readPx(data, SUBJECT_PX)).toEqual({ r: 150, g: 110, b: 70, a: 255 })
    expect(readPx(data, HIGHLIGHT_PX)).toEqual({ r: 235, g: 196, b: 120, a: 255 })
  })

  it('边缘过渡像素去污染，绿分量被解掉且各通道不越界', () => {
    const data = makeRow()
    processMatchPixels(data, GREEN, TOLERANCE, FEATHER)

    const px = readPx(data, FRINGE_PX)
    const raw = { r: ROW[FRINGE_PX]![0]!, g: ROW[FRINGE_PX]![1]!, b: ROW[FRINGE_PX]![2]! }

    // 落在羽化带内：半透保留，而不是被整片吃掉
    expect(px.a).toBeGreaterThan(0)
    expect(px.a).toBeLessThan(255)
    // key 色分量被 un-premultiply 解掉
    expect(px.g).toBeLessThan(raw.g)
    expect(greenExcess(px)).toBeLessThan(greenExcess(raw))
    expect([px.r, px.g, px.b].every((v) => v >= 0 && v <= 255)).toBe(true)
  })

  it('不透明的近背景像素只削绿溢，不反色、不动其它通道', () => {
    const data = makeRow()
    const raw = { r: ROW[HALF_MIX_PX]![0]!, g: ROW[HALF_MIX_PX]![1]!, b: ROW[HALF_MIX_PX]![2]! }
    processMatchPixels(data, GREEN, TOLERANCE, FEATHER)

    const px = readPx(data, HALF_MIX_PX)
    const neutralBaseline = (px.r + px.b) / 2

    expect(px.a).toBe(255)
    expect(px.g).toBeLessThan(raw.g)
    expect(px.r).toBe(raw.r)
    expect(px.b).toBe(raw.b)
    // 绿分量被压到中性基线：黑底下不再偏绿
    expect(px.g).toBeLessThanOrEqual(neutralBaseline + 0.5)
    // 且不越过基线（不反色、不把主体抽绿）
    expect(px.g).toBeGreaterThanOrEqual(neutralBaseline - 0.5)
  })

  it('中性幕（白）key 对同一批像素完全 noop', () => {
    const data = makeRow()
    processMatchPixels(data, WHITE, TOLERANCE, FEATHER)

    ROW.forEach((px, i) => {
      expect(readPx(data, i)).toEqual({ r: px[0]!, g: px[1]!, b: px[2]!, a: 255 })
    })
  })

  it('已有透明的像素不会被重新变回不透明', () => {
    const data = makeRow()
    data[SUBJECT_PX * 4 + 3] = 128
    processMatchPixels(data, GREEN, TOLERANCE, FEATHER)

    expect(readPx(data, SUBJECT_PX)).toEqual({ r: 150, g: 110, b: 70, a: 128 })
  })
})
