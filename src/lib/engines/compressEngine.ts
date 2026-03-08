import imageCompression from 'browser-image-compression'
import type { ImageProcessor, ProcessResult } from './types'

export interface CompressionOptions {
  quality: number
  maxSizeMB?: number
  maxWidth?: number
  maxHeight?: number
  format?: 'image/jpeg' | 'image/png' | 'image/webp'
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

  // 如果压缩后反而变大了，保留原图
  if (compressedFile.size >= file.size) {
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
