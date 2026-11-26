/**
 * 把 DPI 写进文件头：PNG 用 `pHYs`（像素/米），JPEG 用 JFIF APP0 的 density。
 *
 * 浏览器 canvas.toBlob 不会写 DPI，印刷/排版软件读到的就是 72dpi。
 * 这里只改元数据，不碰像素与压缩数据；WebP 没有等价的通用字段，原样返回。
 */

export const DPI_OPTIONS = [72, 150, 300, 600] as const

export function pxToCm(px: number, dpi: number): number {
  if (!Number.isFinite(px) || !Number.isFinite(dpi) || dpi <= 0) return 0
  return (px / dpi) * 2.54
}

export function formatCm(px: number, dpi: number): string {
  const cm = pxToCm(px, dpi)
  return cm >= 100 ? cm.toFixed(0) : cm.toFixed(1)
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((v, i) => bytes[i] === v)
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) >>> 0) +
    (bytes[offset + 1]! << 16) +
    (bytes[offset + 2]! << 8) +
    bytes[offset + 3]!
  )
}

function writeU32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff
  bytes[offset + 1] = (value >>> 16) & 0xff
  bytes[offset + 2] = (value >>> 8) & 0xff
  bytes[offset + 3] = value & 0xff
}

function chunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset]!,
    bytes[offset + 1]!,
    bytes[offset + 2]!,
    bytes[offset + 3]!
  )
}

/** 返回新字节；找不到结构时原样返回 */
export function injectPngDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  if (!isPng(bytes) || !(dpi > 0)) return bytes
  const ppm = Math.max(1, Math.round(dpi / 0.0254))

  let offset = 8
  let ihdrEnd = -1
  while (offset + 12 <= bytes.length) {
    const length = readU32(bytes, offset)
    const type = chunkType(bytes, offset + 4)
    const end = offset + 12 + length
    if (end > bytes.length) return bytes

    if (type === 'pHYs' && length === 9) {
      const copy = new Uint8Array(bytes)
      writeU32(copy, offset + 8, ppm)
      writeU32(copy, offset + 12, ppm)
      copy[offset + 16] = 1
      writeU32(copy, offset + 8 + 9, crc32(copy, offset + 4, offset + 8 + 9))
      return copy
    }
    if (type === 'IHDR') ihdrEnd = end
    if (type === 'IDAT' || type === 'IEND') break
    offset = end
  }

  if (ihdrEnd < 0) return bytes

  const inserted = new Uint8Array(bytes.length + 21)
  inserted.set(bytes.subarray(0, ihdrEnd), 0)
  const p = ihdrEnd
  writeU32(inserted, p, 9)
  inserted.set([0x70, 0x48, 0x59, 0x73], p + 4) // pHYs
  writeU32(inserted, p + 8, ppm)
  writeU32(inserted, p + 12, ppm)
  inserted[p + 16] = 1
  writeU32(inserted, p + 17, crc32(inserted, p + 4, p + 17))
  inserted.set(bytes.subarray(ihdrEnd), ihdrEnd + 21)
  return inserted
}

/** 只改 JFIF APP0 的 density 字段；没有 JFIF 段（如 EXIF-first）时原样返回 */
export function injectJpegDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  if (bytes.length < 20 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes
  if (bytes[2] !== 0xff || bytes[3] !== 0xe0) return bytes
  const identifier = String.fromCharCode(...bytes.subarray(6, 11))
  if (identifier !== 'JFIF\0') return bytes
  const copy = new Uint8Array(bytes)
  const clamped = Math.max(1, Math.min(65535, Math.round(dpi)))
  copy[13] = 1 // units = dots per inch
  copy[14] = (clamped >>> 8) & 0xff
  copy[15] = clamped & 0xff
  copy[16] = (clamped >>> 8) & 0xff
  copy[17] = clamped & 0xff
  return copy
}

export async function withDpi(blob: Blob, dpi: number, format: string): Promise<Blob> {
  if (!(dpi > 0)) return blob
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let next: Uint8Array
  if (format === 'image/png') next = injectPngDpi(bytes, dpi)
  else if (format === 'image/jpeg') next = injectJpegDpi(bytes, dpi)
  else return blob
  if (next === bytes) return blob
  // 复制进新的 ArrayBuffer 支撑的视图，避免 SharedArrayBuffer 分支的类型收窄问题
  const out = new Uint8Array(next.length)
  out.set(next)
  return new Blob([out], { type: blob.type })
}

/** 读取 PNG 的 pHYs（像素/米），供 e2e/单测复核 */
export function readPngDpm(bytes: Uint8Array): number | null {
  if (!isPng(bytes)) return null
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = readU32(bytes, offset)
    const type = chunkType(bytes, offset + 4)
    if (type === 'pHYs' && length === 9) return readU32(bytes, offset + 8)
    if (type === 'IEND') break
    offset += 12 + length
  }
  return null
}
