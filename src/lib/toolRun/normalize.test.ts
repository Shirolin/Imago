import { describe, it, expect } from 'vitest'
import { normalizeEngineOutput, normalizeProgress } from './normalize'

/**
 * 引擎返回值归一化。
 *
 * 这层的存在是因为引擎的返回形状真的有三种，且都是当前在跑的路径：
 * { blob, size }（多数引擎）、{ blobs, size }（splitEngine）、
 * 裸 Blob（bgRemoveEngine:77 / matchBgRemoveEngine:123 —— 签名声明
 * Promise<ProcessResult> 但实际 resolve(blob)）。归一一次，胜过七个视图各写一遍
 * `typedResult.blob || (result as Blob)`。
 */

describe('normalizeEngineOutput', () => {
  it('ProcessResult 单产出：取 blob，size 缺失时回退 blob 体积', () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    expect(normalizeEngineOutput({ blob, size: 42 })).toEqual({
      outputs: [blob],
      size: 42,
      width: undefined,
      height: undefined,
      skipped: undefined
    })
    expect(normalizeEngineOutput({ blob })?.size).toBe(blob.size)
  })

  it('裸 Blob（bgRemove / matchBgRemove 的真实返回）', () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    const out = normalizeEngineOutput(blob)
    expect(out?.outputs).toEqual([blob])
    expect(out?.size).toBe(blob.size)
  })

  it('裸 Blob[] 过滤掉非 Blob 成员', () => {
    const a = new Blob(['a'])
    const b = new Blob(['b'])
    const out = normalizeEngineOutput([a, 'not-a-blob', b])
    expect(out?.outputs).toEqual([a, b])
    expect(out?.size).toBe(a.size)
  })

  it('splitEngine 形态：blobs 优先于 blob', () => {
    const only = new Blob(['a'])
    const one = new Blob(['1'])
    const two = new Blob(['22'])
    const out = normalizeEngineOutput({ blobs: [one, two], blob: only, size: 0 })
    expect(out?.outputs).toEqual([one, two])
    // size 为 0 属无效值，回退首个产物体积
    expect(out?.size).toBe(one.size)
  })

  it('透传 skipped / width / height', () => {
    const blob = new Blob(['x'])
    const out = normalizeEngineOutput({ blob, skipped: true, width: 10, height: 20 })
    expect(out?.skipped).toBe(true)
    expect(out?.width).toBe(10)
    expect(out?.height).toBe(20)
  })

  it('空产出返回 null——调用方据此不写结果，杜绝「done 但无结果」', () => {
    expect(normalizeEngineOutput(undefined)).toBeNull()
    expect(normalizeEngineOutput(null)).toBeNull()
    expect(normalizeEngineOutput({})).toBeNull()
    expect(normalizeEngineOutput({ blob: undefined, blobs: [] })).toBeNull()
    expect(normalizeEngineOutput([])).toBeNull()
    expect(normalizeEngineOutput('nonsense')).toBeNull()
  })

  it('blobs 与 blob 同时缺失时按无结果处理', () => {
    expect(normalizeEngineOutput({ blobs: [], blob: undefined, size: 10 })).toBeNull()
  })
})

describe('normalizeProgress', () => {
  it('0-1 与 0-100 两种上报量纲归一到同一读数', () => {
    // 单任务路径写引擎原始值，队列路径写聚合百分比
    expect(normalizeProgress(0.5)).toBe(0.5)
    expect(normalizeProgress(50)).toBe(0.5)
    expect(normalizeProgress(0.25)).toBe(normalizeProgress(25))
    expect(normalizeProgress(1)).toBe(normalizeProgress(100))
  })

  it('边界钳制', () => {
    expect(normalizeProgress(0)).toBe(0)
    expect(normalizeProgress(-1)).toBe(0)
    expect(normalizeProgress(120)).toBe(1)
  })

  /**
   * 量纲判定在 1.0 附近本质歧义：1.5 可能是「单任务报了 150%」（应钳到 1）
   * 也可能是「队列聚合到 1.5%」（应读作 0.015）。此处选后者——引擎上报超过 1 的
   * 值实际只出现在队列聚合路径上，而把 1.5% 误读成 100% 才是可见的 UI 事故。
   * 真正需要区分的场景（同批混用两种量纲）由 useImageProcessor 的调用路径决定，
   * 不靠数值猜测。
   */
  it('>1 的值按队列百分比解释', () => {
    expect(normalizeProgress(1.5)).toBeCloseTo(0.015)
    expect(normalizeProgress(100)).toBe(1)
  })

  it('非法值归零，避免 CTA 显示 NaN%', () => {
    expect(normalizeProgress(NaN)).toBe(0)
    expect(normalizeProgress(Infinity)).toBe(0)
  })
})
