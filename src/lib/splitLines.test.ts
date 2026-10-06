import { describe, it, expect } from 'vitest'
import { clampWithin, clampDraggedLine, clampNewLine, snapLine, gridLines } from './splitLines'

/**
 * 分割线钳制与吸附的边界验证。
 *
 * 这组约束（每个切片至少 1px、线不重叠）原先内联在 SplitView 且无测试，
 * 而越界会产生零宽切片——引擎只能兜底 reject，用户看到的是无反馈的静默失败。
 */

describe('clampWithin', () => {
  it('区间内原样返回', () => {
    expect(clampWithin(50, 0, 100, 100)).toBe(50)
  })

  it('贴到相邻线内侧（各留 1px）', () => {
    // 下界 prev+1=30，上界 next-1=70
    expect(clampWithin(10, 29, 71, 100)).toBe(30)
    expect(clampWithin(90, 29, 71, 100)).toBe(70)
  })

  it('不越过画布两端', () => {
    expect(clampWithin(-5, 0, 100, 100)).toBe(1)
    expect(clampWithin(500, 0, 100, 100)).toBe(99)
  })

  it('相邻线间隙 ≤1px 时退化为单点，而非区间反转', () => {
    // prev=50, next=51 → lo=min(51,99)=51；hi=max(min(50,99),51)=51 → 收敛到 51
    const r = clampWithin(50, 50, 51, 100)
    expect(r).toBe(51)
    // 关键：结果必须落在 [lo, hi] 内，不能因为原始区间反转而返回任意值
    const lo = Math.min(Math.max(51, 1), 99)
    const hi = Math.max(Math.min(50, 99), lo)
    expect(r).toBeGreaterThanOrEqual(lo)
    expect(r).toBeLessThanOrEqual(hi)
  })

  it('无邻线（首/尾）时只受画布边界约束', () => {
    expect(clampWithin(-100, 0, 1000, 100)).toBe(1)
    expect(clampWithin(999, 0, 1000, 100)).toBe(99)
  })
})

describe('clampDraggedLine', () => {
  const lines = [20, 50, 80]

  it('中间线被两侧邻线夹住', () => {
    // index=1 → prev=20, next=80
    expect(clampDraggedLine(10, lines, 1, 100)).toBe(21)
    expect(clampDraggedLine(95, lines, 1, 100)).toBe(79)
    expect(clampDraggedLine(55, lines, 1, 100)).toBe(55)
  })

  it('首线只有下界（0）与右侧邻线', () => {
    // index=0 → prev=0, next=lines[1]=50 → 钳到 [1, 49]
    expect(clampDraggedLine(-10, lines, 0, 100)).toBe(1)
    expect(clampDraggedLine(100, lines, 0, 100)).toBe(49)
  })

  it('尾线只有左侧邻线与画布末端', () => {
    // index=2 → prev=lines[1]=50, next=max=100 → 钳到 [51, 99]
    expect(clampDraggedLine(-10, lines, 2, 100)).toBe(51)
    expect(clampDraggedLine(200, lines, 2, 100)).toBe(99)
  })

  it('空数组（无任何线）时退化为画布内', () => {
    expect(clampDraggedLine(-5, [], 0, 100)).toBe(1)
    expect(clampDraggedLine(500, [], 0, 100)).toBe(99)
  })
})

describe('clampNewLine', () => {
  it('落在两线之间时按邻线钳制', () => {
    const lines = [20, 80]
    // pos=10 → k=0（20>10），prev=0, next=20 → 钳到 [1,19]
    expect(clampNewLine(10, lines, 100)).toBe(10)
    expect(clampNewLine(-5, lines, 100)).toBe(1)
    // pos=90 → k=2，prev=80, next=100 → 钳到 [81,99]
    expect(clampNewLine(99, lines, 100)).toBe(99)
  })

  it('相邻线间隙 ≤1px 时返回 null（拒绝插入重复线）', () => {
    const lines = [50, 51]
    // 50 与 51 之间无空隙，任何插入位置都会被钳到边界上 → null
    expect(clampNewLine(50.5, lines, 100)).toBeNull()
  })

  it('贴边插入：紧邻既有线但仍有 1px 空隙时可插入', () => {
    const lines = [50]
    // pos=50.5 → prev=50, next=100，钳到 [51,99]，有空间
    expect(clampNewLine(50.5, lines, 100)).toBe(51)
  })

  it('空数组时可插入画布内任意位置', () => {
    expect(clampNewLine(50, [], 100)).toBe(50)
    expect(clampNewLine(-1, [], 100)).toBe(1)
  })

  it('结果永不与既有线重合', () => {
    const lines = [30, 60]
    for (let pos = 0; pos <= 100; pos += 0.5) {
      const r = clampNewLine(pos, lines, 100)
      if (r === null) continue
      expect(lines).not.toContain(r)
    }
  })
})

describe('snapLine', () => {
  const threshold = 15 / 2 // scale=2 时的屏幕 15px = 画布 7.5

  it('吸附到起点', () => {
    expect(snapLine(5, 100, threshold)).toEqual({ pos: 0, snapped: true })
  })

  it('吸附到终点', () => {
    expect(snapLine(95, 100, threshold)).toEqual({ pos: 100, snapped: true })
  })

  it('吸附到中点', () => {
    expect(snapLine(45, 100, threshold)).toEqual({ pos: 50, snapped: true })
  })

  it('远离基准位时不吸附', () => {
    expect(snapLine(70, 100, threshold)).toEqual({ pos: 70, snapped: false })
  })

  it('阈值边界严格（起点侧 pos < threshold，末端侧用绝对值）', () => {
    expect(snapLine(7.5, 100, threshold).snapped).toBe(false)
    expect(snapLine(7.4, 100, threshold).snapped).toBe(true)
  })
})

describe('gridLines', () => {
  it('3 等分得到 2 条内部线', () => {
    expect(gridLines(3, 300)).toEqual([100, 200])
  })

  it('1 等分无内部线', () => {
    expect(gridLines(1, 300)).toEqual([])
  })

  it('2 等分得到 1 条中线', () => {
    expect(gridLines(2, 300)).toEqual([150])
  })

  it('结果严格递增且落在 (0, max) 内', () => {
    const out = gridLines(7, 350)
    expect(out).toHaveLength(6)
    for (let i = 0; i < out.length; i++) {
      expect(out[i]!).toBeGreaterThan(0)
      expect(out[i]!).toBeLessThan(350)
      if (i > 0) expect(out[i]!).toBeGreaterThan(out[i - 1]!)
    }
  })
})
