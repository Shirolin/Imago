import imageCompression from 'browser-image-compression'
import type { ImageProcessor, ProcessResult } from './types'

export interface CompressionOptions {
  quality: number
  maxSizeMB?: number
  maxWidth?: number
  maxHeight?: number
  format?:
    | 'image/jpeg'
    | 'image/png'
    | 'image/webp'
    | 'image/avif'
    | 'image/jxl'
    | 'image/webp2'
    | 'image/heif'
    | 'image/jpeg-li'
  colors?: number // 针对 PNG 的颜色数量量化
  effort?: number // 压缩/优化强度 (1-9)
  keepOriginalIfLarger?: boolean // 如果变大是否保留原图
}

export const compressEngine: ImageProcessor<CompressionOptions> = async (file, options) => {
  const compressionOptions = {
    maxSizeMB: options.maxSizeMB || 10,
    maxWidthOrHeight: options.maxWidth || options.maxHeight || 4096,
    useWebWorker: true,
    initialQuality: options.quality,
    fileType: options.format,
    signal: options.signal
  }

  const compressedFile = await imageCompression(file, compressionOptions)

  // 决定是否保留原图
  const shouldKeepOriginal = options.keepOriginalIfLarger !== false // 默认 true
  if (shouldKeepOriginal && compressedFile.size >= file.size) {
    return {
      blob: file,
      size: file.size
    }
  }

  return {
    blob: compressedFile,
    size: compressedFile.size
  }
}
