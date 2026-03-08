import imageCompression from 'browser-image-compression'
import type { ImageProcessor, ProcessResult } from './types'

export interface CompressionOptions {
  quality: number
}

export const compressEngine: ImageProcessor<CompressionOptions> = async (file, options) => {
  const compressionOptions = {
    maxSizeMB: 10,
    maxWidthOrHeight: 4096,
    useWebWorker: true,
    initialQuality: options.quality,
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
