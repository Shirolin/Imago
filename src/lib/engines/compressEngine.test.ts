import { describe, it, expect, beforeEach, vi } from 'vitest'
import imageCompression from 'browser-image-compression'
import { compressEngine } from './compressEngine'
import { DEFAULT_COMPRESS_LONG_EDGE } from '../limits'

vi.mock('browser-image-compression', () => ({
  default: vi.fn()
}))

vi.mock('../utils/formatSupport', () => ({
  isFormatSupported: vi.fn(async () => true)
}))

vi.mock('../utils/metadata', () => ({
  injectMetadata: vi.fn(async (_f, buf) => buf)
}))

const compressionCalls: Array<Record<string, unknown>> = []

beforeEach(() => {
  compressionCalls.length = 0
  vi.mocked(imageCompression).mockImplementation(async (file, options) => {
    compressionCalls.push(options as Record<string, unknown>)
    return new File(['x'], 'out.jpg', {
      type: (options as { fileType?: string }).fileType || 'image/jpeg'
    })
  })
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({
      width: 1000,
      height: 2000,
      close: vi.fn()
    }))
  )
})

function makeFile(type = 'image/jpeg') {
  return new File(['x'], 'a.jpg', { type })
}

describe('compressEngine 策略', () => {
  it('质量模式不传 maxSizeMB', async () => {
    await compressEngine(makeFile(), { quality: 0.8, mode: 'quality' })
    expect(compressionCalls[0]).not.toHaveProperty('maxSizeMB')
  })

  it('目标体积模式传入 maxSizeMB', async () => {
    await compressEngine(makeFile(), { quality: 0.8, mode: 'target', maxSizeMB: 0.5 })
    expect(compressionCalls[0]?.maxSizeMB).toBe(0.5)
  })

  it('未填分辨率时默认 4096 长边', async () => {
    await compressEngine(makeFile(), { quality: 0.8 })
    expect(compressionCalls[0]?.maxWidthOrHeight).toBe(DEFAULT_COMPRESS_LONG_EDGE)
  })

  it('只填宽按宽轴约束长边', async () => {
    await compressEngine(makeFile(), { quality: 0.8, maxWidth: 500 })
    expect(compressionCalls[0]?.maxWidthOrHeight).toBe(1000)
  })

  it('换格式变大时不保留原图', async () => {
    vi.mocked(imageCompression).mockResolvedValueOnce(
      new File([new Uint8Array(200)], 'big.png', { type: 'image/png' })
    )
    const file = makeFile('image/jpeg')
    Object.defineProperty(file, 'size', { value: 100 })
    const result = await compressEngine(file, {
      quality: 0.8,
      format: 'image/png',
      keepOriginalIfLarger: true
    })
    expect(result.skipped).toBeUndefined()
    expect(result.blob!.type).toBe('image/png')
  })
})
