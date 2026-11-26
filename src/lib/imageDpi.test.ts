import { describe, it, expect } from 'vitest'
import { formatCm, injectJpegDpi, injectPngDpi, pxToCm, readPngDpm, withDpi } from './imageDpi'

// 独立实现，避免用被测代码的 CRC 表「自证」
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) {
    c ^= b
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: number[]): number[] {
  const typeBytes = [...type].map((ch) => ch.charCodeAt(0))
  const length = data.length
  const payload = [...typeBytes, ...data]
  const crc = crc32(new Uint8Array(payload))
  return [
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
    ...payload,
    (crc >>> 24) & 0xff,
    (crc >>> 16) & 0xff,
    (crc >>> 8) & 0xff,
    crc & 0xff
  ]
}

function minimalPng(extraBeforeIdat: number[] = []): Uint8Array {
  return new Uint8Array([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
    ...extraBeforeIdat,
    ...chunk('IDAT', [0x78, 0x9c]),
    ...chunk('IEND', [])
  ])
}

function minimalJpeg(): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
  ])
}

describe('PNG DPI', () => {
  it('没有 pHYs 时插在 IHDR 之后，且 CRC 正确', () => {
    const out = injectPngDpi(minimalPng(), 300)
    expect(out.length).toBe(minimalPng().length + 21)
    expect(readPngDpm(out)).toBe(11811)

    // 逐块校验 CRC，插错位置会立刻暴露
    let offset = 8
    while (offset < out.length) {
      const length =
        (out[offset]! << 24) | (out[offset + 1]! << 16) | (out[offset + 2]! << 8) | out[offset + 3]!
      const type = String.fromCharCode(...out.subarray(offset + 4, offset + 8))
      const stored =
        ((out[offset + 8 + length]! << 24) |
          (out[offset + 9 + length]! << 16) |
          (out[offset + 10 + length]! << 8) |
          out[offset + 11 + length]!) >>>
        0
      expect(crc32(out.subarray(offset + 4, offset + 8 + length))).toBe(stored)
      offset += 12 + length
      expect(['IHDR', 'pHYs', 'IDAT', 'IEND', 'pHYs']).toContain(type)
    }
  })

  it('已有 pHYs 时原地改写而不是重复插入', () => {
    const first = injectPngDpi(minimalPng(), 300)
    const second = injectPngDpi(first, 72)
    expect(second.length).toBe(first.length)
    expect(readPngDpm(second)).toBe(2835)
  })

  it('非 PNG 字节原样返回', () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    expect(injectPngDpi(bytes, 300)).toBe(bytes)
  })
})

describe('JPEG DPI', () => {
  it('改写 JFIF 的 units 与 density', () => {
    const out = injectJpegDpi(minimalJpeg(), 300)
    expect(out[13]).toBe(1)
    expect((out[14]! << 8) | out[15]!).toBe(300)
    expect((out[16]! << 8) | out[17]!).toBe(300)
  })

  it('不是 JFIF 头时不动', () => {
    const exif = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 4, 1, 2])
    expect(injectJpegDpi(exif, 300)).toBe(exif)
  })
})

describe('withDpi', () => {
  it('按 format 分派，WebP 原样返回', async () => {
    const png = new Blob([new Uint8Array(minimalPng())], { type: 'image/png' })
    const out = await withDpi(png, 150, 'image/png')
    expect(readPngDpm(new Uint8Array(await out.arrayBuffer()))).toBe(5906)

    const webp = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
    expect(await withDpi(webp, 300, 'image/webp')).toBe(webp)
  })

  it('dpi 为 0 时不处理', async () => {
    const png = new Blob([new Uint8Array(minimalPng())], { type: 'image/png' })
    expect(await withDpi(png, 0, 'image/png')).toBe(png)
  })
})

describe('打印尺寸', () => {
  it('300dpi 下 3000px 为 25.4cm', () => {
    expect(pxToCm(3000, 300)).toBeCloseTo(25.4, 5)
    expect(formatCm(3000, 300)).toBe('25.4')
    expect(formatCm(5906, 300)).toBe('50.0')
  })
})
