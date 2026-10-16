import { describe, it, expect } from 'vitest'
import { computeLayout } from './combineLayout'

/**
 * 拼接布局几何验证。
 *
 * 这套竖排/横排/网格几何原先在 CombineView（预览）与 combineEngine（导出）
 * 各手写一份，靠共享 store.images 顺序勉强同步；两处一旦漂移，用户看到的
 * 预览和拿到的成图就是两张图。现在几何只有这一个实现，这里锁住它。
 *
 * 各用例的期望值与重构前 combineEngine 的行为逐一对齐（原值由
 * combineEngine.test.ts 既有断言背书）。
 */

const ALIGN_DEFAULT = { alignment: 'start' as const, spacing: 0, padding: 0 }

describe('computeLayout 纵向', () => {
  it('smart 模式：宽度齐最大宽，高度等比，尾部间距不计入', () => {
    const layout = computeLayout(
      [
        { width: 200, height: 100 },
        { width: 100, height: 100 }
      ],
      { ...ALIGN_DEFAULT, direction: 'vertical', layoutMode: 'smart', spacing: 10 }
    )
    expect(layout.width).toBe(200)
    // 画布高 = 100 + 10 + 200，尾部 10px 间距被剪掉
    expect(layout.height).toBe(310)
    expect(layout.cells[0]).toMatchObject({ x: 0, y: 0, w: 200, h: 100 })
    expect(layout.cells[1]).toMatchObject({ x: 0, y: 110, w: 200, h: 200 })
  })

  it('original 模式：center 逐张水平居中', () => {
    const layout = computeLayout(
      [
        { width: 100, height: 50 },
        { width: 50, height: 50 }
      ],
      { ...ALIGN_DEFAULT, direction: 'vertical', layoutMode: 'original', alignment: 'center' }
    )
    expect(layout.cells[0]).toMatchObject({ x: 0, y: 0, w: 100, h: 50 })
    expect(layout.cells[1]).toMatchObject({ x: 25, y: 50, w: 50, h: 50 })
  })

  it('original 模式：end 对齐右缘', () => {
    const layout = computeLayout(
      [
        { width: 100, height: 50 },
        { width: 50, height: 50 }
      ],
      {
        ...ALIGN_DEFAULT,
        direction: 'vertical',
        layoutMode: 'original',
        alignment: 'end'
      }
    )
    expect(layout.cells[1]).toMatchObject({ x: 50, y: 50, w: 50, h: 50 })
  })

  it('padding 计入画布并平移全部格子', () => {
    const layout = computeLayout([{ width: 100, height: 100 }], {
      ...ALIGN_DEFAULT,
      direction: 'vertical',
      padding: 8
    })
    expect(layout.width).toBe(116)
    expect(layout.height).toBe(116)
    expect(layout.cells[0]).toMatchObject({ x: 8, y: 8, w: 100, h: 100 })
  })
})

describe('computeLayout 横向', () => {
  it('smart 模式：高度齐最大高，宽度等比', () => {
    const layout = computeLayout(
      [
        { width: 100, height: 200 },
        { width: 200, height: 100 }
      ],
      { ...ALIGN_DEFAULT, direction: 'horizontal', layoutMode: 'smart', spacing: 10 }
    )
    expect(layout.width).toBe(510) // 100 + 10 + 400，尾部剪掉
    expect(layout.height).toBe(200)
    expect(layout.cells[0]).toMatchObject({ x: 0, y: 0, w: 100, h: 200 })
    expect(layout.cells[1]).toMatchObject({ x: 110, y: 0, w: 400, h: 200 })
  })
})

describe('computeLayout 网格', () => {
  it('smart 模式：Cover 填满单元格并携带溢出裁剪区', () => {
    const layout = computeLayout(
      [
        { width: 100, height: 50 },
        { width: 50, height: 100 }
      ],
      { ...ALIGN_DEFAULT, direction: 'grid', layoutMode: 'smart', columns: 2 }
    )
    expect(layout.width).toBe(200)
    expect(layout.height).toBe(100)
    // img1: ratio = max(100/100, 100/50) = 2 → 200×100，offsetX = -50
    expect(layout.cells[0]).toMatchObject({ x: -50, y: 0, w: 200, h: 100 })
    expect(layout.cells[0]?.clip).toEqual({ x: 0, y: 0, w: 100, h: 100 })
    // img2: offsetY = -50 → x = 100
    expect(layout.cells[1]).toMatchObject({ x: 100, y: -50, w: 100, h: 200 })
    expect(layout.cells[1]?.clip).toEqual({ x: 100, y: 0, w: 100, h: 100 })
  })

  it('original 模式：无 clip，end 对齐单元格右/下缘', () => {
    const layout = computeLayout(
      [
        { width: 60, height: 40 },
        { width: 30, height: 30 }
      ],
      {
        ...ALIGN_DEFAULT,
        direction: 'grid',
        layoutMode: 'original',
        alignment: 'end',
        columns: 2
      }
    )
    expect(layout.cells[0]?.clip).toBeUndefined()
    // img2: x = 1*(60+0) + (60-30) = 90，y = 40-30 = 10
    expect(layout.cells[1]).toMatchObject({ x: 90, y: 10, w: 30, h: 30 })
  })

  it('columns ≤0 时回退到 √n 取整列数', () => {
    const layout = computeLayout(
      Array.from({ length: 5 }, () => ({ width: 10, height: 10 })),
      { ...ALIGN_DEFAULT, direction: 'grid', columns: 0 }
    )
    // cols = ceil(√5) = 3 → width = 3*10 = 30
    expect(layout.width).toBe(30)
    expect(layout.cells).toHaveLength(5)
  })

  it('spacing 计入格间距，与 padding 叠加', () => {
    const layout = computeLayout(
      [
        { width: 10, height: 10 },
        { width: 10, height: 10 }
      ],
      { ...ALIGN_DEFAULT, direction: 'grid', columns: 2, spacing: 6, padding: 4 }
    )
    // width = 2*10 + 1*6 + 2*4 = 34
    expect(layout.width).toBe(34)
    expect(layout.cells[0]).toMatchObject({ x: 4, y: 4, w: 10, h: 10 })
    expect(layout.cells[1]).toMatchObject({ x: 20, y: 4, w: 10, h: 10 })
  })
})

describe('computeLayout 布局模式缺省', () => {
  it('不传 layoutMode 默认 smart（与引擎历史行为一致）', () => {
    const layout = computeLayout(
      [
        { width: 10, height: 5 },
        { width: 10, height: 10 }
      ],
      { ...ALIGN_DEFAULT, direction: 'vertical' }
    )
    expect(layout.cells[0]).toMatchObject({ w: 10, h: 5 })
    expect(layout.cells[1]).toMatchObject({ w: 10, h: 10 })
  })
})
