import { describe, it, expect } from 'vitest'
import {
  MAX_TARGET_SIZE_KB,
  MAX_PROCESS_SIDE,
  DEFAULT_COMPRESS_LONG_EDGE,
  fitWithinMaxSide,
  resolveCompressLongEdge,
  shouldKeepOriginalWhenLarger,
  exceedsImportDimensions,
  normalizeOutputMime
} from './limits'

describe('limits', () => {
  it('MAX_TARGET_SIZE_KB 与 50MB 对齐', () => {
    expect(MAX_TARGET_SIZE_KB).toBe(Math.floor((50 * 1024 * 1024) / 1024))
  })

  it('fitWithinMaxSide 保持比例并钳制长边', () => {
    expect(fitWithinMaxSide(8000, 4000, MAX_PROCESS_SIDE)).toEqual({
      width: 8000,
      height: 4000
    })
    expect(fitWithinMaxSide(20000, 10000, MAX_PROCESS_SIDE)).toEqual({
      width: 16384,
      height: 8192
    })
    expect(fitWithinMaxSide(100, 100, MAX_PROCESS_SIDE)).toEqual({ width: 100, height: 100 })
  })

  it('resolveCompressLongEdge 单边按轴约束', () => {
    expect(resolveCompressLongEdge(1000, 2000, 500, undefined)).toBe(1000)
    expect(resolveCompressLongEdge(1000, 2000, undefined, 1000)).toBe(1000)
    expect(resolveCompressLongEdge(4000, 3000, undefined, undefined)).toBe(
      DEFAULT_COMPRESS_LONG_EDGE
    )
    expect(resolveCompressLongEdge(30000, 20000, 20000, 20000)).toBe(MAX_PROCESS_SIDE)
  })

  it('shouldKeepOriginalWhenLarger 仅同格式跳过', () => {
    expect(shouldKeepOriginalWhenLarger(true, 'image/jpeg', 'image/png', 200, 100)).toBe(false)
    expect(shouldKeepOriginalWhenLarger(true, 'image/jpeg', 'image/jpeg-li', 200, 100)).toBe(true)
    expect(shouldKeepOriginalWhenLarger(false, 'image/jpeg', 'image/jpeg', 200, 100)).toBe(false)
  })

  it('exceedsImportDimensions 检测超长边与超像素', () => {
    expect(exceedsImportDimensions(16384, 1000)).toBe(false)
    expect(exceedsImportDimensions(16385, 1000)).toBe(true)
    expect(exceedsImportDimensions(10000, 10001)).toBe(true)
  })

  it('normalizeOutputMime 归一 jpeg-li', () => {
    expect(normalizeOutputMime('image/jpeg-li')).toBe('image/jpeg')
  })
})
