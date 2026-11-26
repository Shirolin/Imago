import { describe, expect, it } from 'vitest'
import {
  bandDetailRatio,
  computeSheetLayout,
  computeUnitGeometry,
  cutDiff,
  edgeDiff,
  gradeSeam,
  mirrorBlendSeams,
  normalizeAngle,
  normalizeSource,
  normalizeTileMode,
  seamQuality,
  seamScore,
  snapToPowerOfTwo
} from './seamless'

describe('computeSheetLayout', () => {
  it('平接按直线网格铺满，画布尺寸 = 单元 × 行列', () => {
    const layout = computeSheetLayout(100, 80, 3, 2, 'straight')
    expect(layout).toMatchObject({ width: 300, height: 160, cols: 3, rows: 2 })
    expect(layout.cells).toHaveLength(6)
    expect(layout.cells[4]).toEqual({ x: 100, y: 80, flipX: false, flipY: false })
  })

  it('1/2 跳接：奇数列下移半格，并补一格回绕单元盖住顶部', () => {
    const layout = computeSheetLayout(100, 80, 2, 2, 'halfDrop')
    const second = layout.cells.find((c) => c.x === 100 && c.y === 40)
    expect(second).toBeDefined()
    expect(layout.cells.some((c) => c.x === 100 && c.y === -40)).toBe(true)
    expect(layout).toMatchObject({ width: 200, height: 160 })
  })

  it('砖块式：奇数行右移半格，并补一格回绕单元盖住左侧', () => {
    const layout = computeSheetLayout(100, 80, 2, 2, 'brick')
    expect(layout.cells.some((c) => c.x === 50 && c.y === 80)).toBe(true)
    expect(layout.cells.some((c) => c.x === -50 && c.y === 80)).toBe(true)
    expect(layout).toMatchObject({ width: 200, height: 160 })
  })

  it('二方连续只沿一个方向铺开', () => {
    expect(computeSheetLayout(100, 80, 3, 5, 'horizontal')).toMatchObject({
      width: 300,
      height: 80,
      rows: 1
    })
    expect(computeSheetLayout(100, 80, 3, 5, 'vertical')).toMatchObject({
      width: 100,
      height: 400,
      cols: 1
    })
  })

  it('镜像平铺按行列奇偶翻转', () => {
    const cells = computeSheetLayout(10, 10, 2, 2, 'mirror').cells
    expect(cells[0]).toEqual({ x: 0, y: 0, flipX: false, flipY: false })
    expect(cells[1]).toEqual({ x: 10, y: 0, flipX: true, flipY: false })
    expect(cells[2]).toEqual({ x: 0, y: 10, flipX: false, flipY: true })
    expect(cells[3]).toEqual({ x: 10, y: 10, flipX: true, flipY: true })
  })

  it('行列数收敛到 1..8', () => {
    expect(computeSheetLayout(10, 10, 0, 99, 'straight')).toMatchObject({ cols: 1, rows: 8 })
  })

  it('未知接版方式回退为平接', () => {
    expect(normalizeTileMode('nope')).toBe('straight')
  })
})

describe('computeUnitGeometry', () => {
  it('锁定比例时 contain 等价于铺满', () => {
    const g = computeUnitGeometry(200, 100, 200, 100)
    expect(g).toMatchObject({ drawX: 0, drawY: 0, drawW: 200, drawH: 100 })
    expect(g).toMatchObject({ seamX: 100, seamY: 50 })
  })

  it('单元比例不同时按 contain 居中留边', () => {
    const g = computeUnitGeometry(100, 50, 100, 100)
    expect(g.drawW).toBe(100)
    expect(g.drawH).toBe(50)
    expect(g.drawY).toBe(25)
  })

  it('间距作为内衬收缩源图', () => {
    const g = computeUnitGeometry(100, 100, 100, 100, { gap: 10 })
    expect(g).toMatchObject({ drawX: 10, drawY: 10, drawW: 80, drawH: 80 })
  })

  it('羽化带不超过接缝两侧可用宽度', () => {
    const g = computeUnitGeometry(100, 100, 100, 100, { feather: 999 })
    expect(g.bandX).toBe(49)
    expect(g.bandY).toBe(49)
  })
})

describe('mirrorBlendSeams', () => {
  const makeData = (w: number, h: number, pick: (x: number) => number[]) => {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const [r, g, b, a] = pick(x)
        const o = (y * w + x) * 4
        data[o] = r!
        data[o + 1] = g!
        data[o + 2] = b!
        data[o + 3] = a!
      }
    }
    return data
  }

  const pixel = (data: Uint8ClampedArray, w: number, x: number, y: number) => {
    const o = (y * w + x) * 4
    return [data[o]!, data[o + 1]!, data[o + 2]!, data[o + 3]!]
  }

  it('接缝两侧收敛到同一混合值，带外像素不变', () => {
    const data = makeData(16, 16, (x) => (x < 8 ? [0, 0, 0, 255] : [255, 255, 255, 255]))
    mirrorBlendSeams(data, 16, 16, 8, 8, 4)

    const left = pixel(data, 16, 7, 4)
    const right = pixel(data, 16, 8, 4)
    expect(left).toEqual(right)
    expect(left[0]).toBeGreaterThan(100)
    expect(left[0]).toBeLessThan(155)
    // 带外（x=0，距接缝 8 > band+1）保持原样
    expect(pixel(data, 16, 0, 4)).toEqual([0, 0, 0, 255])
  })

  it('透明区参与混合时不产生暗色边', () => {
    // 左半透明红、右半不透明蓝：预乘混合后接缝处应仍是蓝，而不是发黑
    const data = makeData(16, 16, (x) => (x < 8 ? [255, 0, 0, 0] : [0, 0, 255, 255]))
    mirrorBlendSeams(data, 16, 16, 8, 8, 4)
    const seam = pixel(data, 16, 8, 0)
    expect(seam[2]).toBeGreaterThan(200)
    expect(seam[3]).toBeGreaterThan(100)
  })

  it('band 为 0 时不做任何修改', () => {
    const data = makeData(8, 8, (x) => (x < 4 ? [0, 0, 0, 255] : [255, 255, 255, 255]))
    const before = new Uint8ClampedArray(data)
    mirrorBlendSeams(data, 8, 8, 4, 4, 0)
    expect(data).toEqual(before)
  })
})

describe('旋转与铺满', () => {
  it('旋转后按外接框 contain，画布内不溢出', () => {
    const g = computeUnitGeometry(200, 100, 100, 100, { rotate: 90 })
    // 旋转 90° 后外接框 100×200，缩到 100 高 → 绘制 100×50
    expect(g.drawW).toBe(100)
    expect(g.drawH).toBe(50)
    expect(g.rotate).toBe(90)
    expect(g.drawX).toBe(0)
    expect(g.drawY).toBe(25)
  })

  it('cover 铺满时允许溢出（用于满版图旋转补角）', () => {
    const g = computeUnitGeometry(200, 100, 100, 100, { cover: true })
    expect(g.drawW).toBe(200)
    expect(g.drawH).toBe(100)
    expect(g.drawX).toBe(-50)
    expect(g.drawY).toBe(0)
  })

  it('满版图改变单元比例时仍铺满，不留透明条带', () => {
    // 800×600 源图进入 1024×512 单元：contain 会留左右透明，cover 直接裁切
    const g = computeUnitGeometry(800, 600, 1024, 512, { cover: true })
    expect(g.drawW).toBe(1024)
    expect(g.drawH).toBe(768)
    expect(g.drawX).toBe(0)
    expect(g.drawY).toBe(-128)
  })

  it('角度归一与非法值', () => {
    expect(normalizeAngle(-90)).toBe(270)
    expect(normalizeAngle(450)).toBe(90)
    expect(normalizeAngle(Number.NaN)).toBe(0)
    const g = computeUnitGeometry(100, 100, 100, 100, { rotate: -90 })
    expect(g.rotate).toBe(270)
  })

  it('旋转时按可见内容装框，透明边距不再把图形挤小', () => {
    // 600×600 源图，内容 461×391 位于 (70,105)；
    // 内容旋转外接框 = 852 / √2 ≈ 602.45 → 缩放 0.9959，几乎保持原大小
    const g = computeUnitGeometry(600, 600, 600, 600, {
      rotate: 45,
      content: { x: 70, y: 105, w: 461, h: 391 }
    })
    expect(g.drawW).toBe(598)
    expect(g.drawH).toBe(598)
    expect(g.drawX).toBe(1)
    expect(g.drawY).toBe(1)
  })

  it('不旋转或铺满时忽略内容框', () => {
    const content = { x: 70, y: 105, w: 461, h: 391 }
    expect(computeUnitGeometry(600, 600, 600, 600, { content }).drawW).toBe(600)
    expect(
      computeUnitGeometry(600, 600, 600, 600, { rotate: 45, cover: true, content }).drawW
    ).toBe(424)
  })
})

describe('snapToPowerOfTwo', () => {
  it('取最近的 2 的幂并收敛范围', () => {
    expect(snapToPowerOfTwo(1000)).toBe(1024)
    expect(snapToPowerOfTwo(600)).toBe(512)
    expect(snapToPowerOfTwo(900)).toBe(1024)
    expect(snapToPowerOfTwo(1)).toBe(64)
    expect(snapToPowerOfTwo(9000)).toBe(8192)
  })
})

describe('接缝评分', () => {
  const makeData = (w: number, h: number, value: (x: number) => number) => {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4
        data[o] = value(x)
        data[o + 1] = value(x)
        data[o + 2] = value(x)
        data[o + 3] = 255
      }
    }
    return data
  }

  it('左右边缘一致时边界差为 0', () => {
    expect(
      edgeDiff(
        makeData(8, 8, () => 128),
        8,
        8
      )
    ).toBe(0)
  })

  it('边缘差计入上下与左右两个方向', () => {
    // 左列 0、右列 255，上下同值：每行 3 个通道各差 255，水平 8 行合计
    // 6120；竖直方向为 0；除以 64 个通道样本 = 95.625
    const data = makeData(8, 8, (x) => (x === 0 ? 0 : x === 7 ? 255 : 128))
    expect(edgeDiff(data, 8, 8)).toBeCloseTo(95.625, 3)
  })

  it('按边界差换算成 0–100（40 视为明显接缝）', () => {
    expect(seamScore(0)).toBe(100)
    expect(seamScore(20)).toBe(50)
    expect(seamScore(40)).toBe(0)
    expect(seamScore(90)).toBe(0)
    expect(seamScore(Number.NaN)).toBe(0)
  })

  it('分档阈值', () => {
    expect(gradeSeam(100)).toBe('perfect')
    expect(gradeSeam(80)).toBe('good')
    expect(gradeSeam(60)).toBe('fair')
    expect(gradeSeam(59)).toBe('poor')
  })
})

describe('normalizeSource', () => {
  it('未知取值回退为满版图', () => {
    expect(normalizeSource('motif')).toBe('motif')
    expect(normalizeSource('nope')).toBe('fullBleed')
    expect(normalizeSource(undefined)).toBe('fullBleed')
  })
})

const makeData = (w: number, h: number, pick: (x: number, y: number) => number[]) => {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pick(x, y)
      const o = (y * w + x) * 4
      data[o] = r!
      data[o + 1] = g!
      data[o + 2] = b!
      data[o + 3] = a!
    }
  }
  return data
}

describe('cutDiff', () => {
  it('量到切位两侧的硬断口', () => {
    const data = makeData(16, 16, (x) => (x < 8 ? [0, 0, 0, 255] : [255, 255, 255, 255]))
    expect(cutDiff(data, 16, 16, 8, 8)).toBeGreaterThan(80)
  })

  it('平坦处为 0', () => {
    const data = makeData(16, 16, () => [120, 120, 120, 255])
    expect(cutDiff(data, 16, 16, 8, 8)).toBe(0)
  })
})

describe('bandDetailRatio', () => {
  const noisy = makeData(64, 64, (x, y) => [
    (x * 37 + y * 11) % 256,
    (x * 17) % 256,
    (y * 29) % 256,
    255
  ])

  it('镜像羽化后接缝带细节下降', () => {
    const blended = new Uint8ClampedArray(noisy)
    mirrorBlendSeams(blended, 64, 64, 32, 32, 8)
    expect(bandDetailRatio(blended, 64, 64, 32, 32, 8)).toBeLessThan(
      bandDetailRatio(noisy, 64, 64, 32, 32, 8)
    )
  })

  it('没有羽化带时视为 1', () => {
    expect(bandDetailRatio(noisy, 64, 64, 32, 32, 0)).toBe(1)
  })
})

describe('seamQuality', () => {
  it('带内细节被抹掉时扣分，细节充足时不超过 100', () => {
    expect(seamQuality(0, 1)).toBe(100)
    expect(seamQuality(0, 0.27)).toBe(27)
    expect(seamQuality(0, 1.9)).toBe(100)
  })
})
