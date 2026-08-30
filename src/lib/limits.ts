/** Imago 全局处理上限（单一数据源） */

export const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB
export const MAX_TARGET_SIZE_KB = Math.floor(MAX_FILE_BYTES / 1024)

/** 通用处理硬顶（resize / crop / filter / exif / wasm 等） */
export const MAX_PROCESS_SIDE = 16384

/** WebP lossy VP8 编码单边上限 */
export const MAX_WEBP_SIDE = 16383

/** 压缩未填分辨率时默认长边约束 */
export const DEFAULT_COMPRESS_LONG_EDGE = 4096

/** 导入闸门：解码后总像素上限 */
export const MAX_IMPORT_PIXELS = 100_000_000 // 100 MP

/** Chrome 合并画布上限 */
export const MAX_COMBINE_CANVAS_SIDE = 32767
export const MAX_COMBINE_CANVAS_AREA = 268_435_456

function capCompressLongEdge(longEdge: number): number {
  return Math.max(1, Math.min(MAX_PROCESS_SIDE, Math.round(longEdge)))
}

export function fitWithinMaxSide(
  width: number,
  height: number,
  maxSide: number
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) }
  }
  if (width <= maxSide && height <= maxSide) {
    return { width: Math.round(width), height: Math.round(height) }
  }
  const scale = Math.min(maxSide / width, maxSide / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

/** browser-image-compression 只接受长边；按宽/高轴约束换算 */
export function resolveCompressLongEdge(
  imgW: number,
  imgH: number,
  maxWidth?: number,
  maxHeight?: number
): number {
  if (maxWidth && maxHeight) {
    const scale = Math.min(1, maxWidth / imgW, maxHeight / imgH)
    return capCompressLongEdge(Math.max(imgW, imgH) * scale)
  }
  if (maxWidth) {
    const scale = Math.min(1, maxWidth / imgW)
    return capCompressLongEdge(Math.max(imgW, imgH) * scale)
  }
  if (maxHeight) {
    const scale = Math.min(1, maxHeight / imgH)
    return capCompressLongEdge(Math.max(imgW, imgH) * scale)
  }
  return Math.min(DEFAULT_COMPRESS_LONG_EDGE, MAX_PROCESS_SIDE)
}

export function normalizeOutputMime(mime: string): string {
  return mime === 'image/jpeg-li' ? 'image/jpeg' : mime
}

export function shouldKeepOriginalWhenLarger(
  keepOriginalIfLarger: boolean | undefined,
  inputType: string,
  outputType: string,
  outputSize: number,
  inputSize: number
): boolean {
  if (keepOriginalIfLarger === false) return false
  if (outputSize < inputSize) return false
  return normalizeOutputMime(outputType) === normalizeOutputMime(inputType)
}

export function exceedsImportDimensions(width: number, height: number): boolean {
  return Math.max(width, height) > MAX_PROCESS_SIDE || width * height > MAX_IMPORT_PIXELS
}
