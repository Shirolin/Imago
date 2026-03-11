import imageCompression from 'browser-image-compression'
import type { ImageProcessor } from './types'
import { isFormatSupported } from '../utils/formatSupport'

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
  // 1. 前置校验：浏览器是否支持该格式的写出
  if (options.format) {
    const targetFormatOrNull = options.format
    const supported = await isFormatSupported(targetFormatOrNull)
    if (!supported) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - TS 无法在异步上下文中识别 targetFormatOrNull 的窄化
      const formatName = targetFormatOrNull.split('/')[1].toUpperCase()
      throw new Error(`浏览器目前不支持导出为 ${formatName} 格式`)
    }
  }

  const compressionOptions = {
    maxSizeMB: options.maxSizeMB || 10,
    maxWidthOrHeight: options.maxWidth || options.maxHeight || 4096,
    useWebWorker: true,
    initialQuality: options.quality,
    fileType: options.format,
    signal: options.signal
  }

  const compressedFile = await imageCompression(file, compressionOptions)

  // 2. 后置校验：检查转换后的核心类型是否符合预期 (防止静默回退)
  if (options.format && options.format !== 'image/jpeg-li') {
    const targetFormatStrict = options.format
    // jpeg-li 比较特殊，它的输出 MIME 仍然是 image/jpeg
    if (compressedFile.type !== targetFormatStrict) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - TS 无法在异步上下文中识别 targetFormatStrict 的窄化
      const formatName = targetFormatStrict.split('/')[1].toUpperCase()
      throw new Error(`转换失败：浏览器拒绝生成 ${formatName} 格式，已自动回退`)
    }
  }

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
