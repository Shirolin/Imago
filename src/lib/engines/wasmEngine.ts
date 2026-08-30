import type { ImageProcessor } from './types'
import type { CompressionOptions } from './compressEngine'
import { injectMetadata } from '../utils/metadata'
import {
  DEFAULT_COMPRESS_LONG_EDGE,
  MAX_PROCESS_SIDE,
  MAX_WEBP_SIDE,
  fitWithinMaxSide,
  shouldKeepOriginalWhenLarger
} from '../limits'

/**
 * WebAssembly 核心图片处理引擎
 * 利用 jSquash 底层 C/C++/Rust 编解码器在纯前端实现浏览器不支持的复杂格式转换 (如 AVIF, JXL)
 */
export const wasmEngine: ImageProcessor<CompressionOptions> = async (file, options) => {
  const format = options.format || file.type

  const bitmap = await createImageBitmap(file)
  let targetWidth = bitmap.width
  let targetHeight = bitmap.height

  if (options.maxWidth && options.maxHeight) {
    const scale = Math.min(1, options.maxWidth / targetWidth, options.maxHeight / targetHeight)
    targetWidth *= scale
    targetHeight *= scale
  } else if (options.maxWidth) {
    if (targetWidth > options.maxWidth) {
      const ratio = targetWidth / targetHeight
      targetWidth = options.maxWidth
      targetHeight = targetWidth / ratio
    }
  } else if (options.maxHeight) {
    if (targetHeight > options.maxHeight) {
      const ratio = targetWidth / targetHeight
      targetHeight = options.maxHeight
      targetWidth = targetHeight * ratio
    }
  } else {
    const fitted = fitWithinMaxSide(targetWidth, targetHeight, DEFAULT_COMPRESS_LONG_EDGE)
    targetWidth = fitted.width
    targetHeight = fitted.height
  }

  const processCap = fitWithinMaxSide(targetWidth, targetHeight, MAX_PROCESS_SIDE)
  targetWidth = processCap.width
  targetHeight = processCap.height

  if (format === 'image/webp') {
    const webpCap = fitWithinMaxSide(targetWidth, targetHeight, MAX_WEBP_SIDE)
    targetWidth = webpCap.width
    targetHeight = webpCap.height
  }

  targetWidth = Math.round(targetWidth)
  targetHeight = Math.round(targetHeight)

  const canvas = new OffscreenCanvas(targetWidth, targetHeight)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建离屏 Canvas 上下文')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
  bitmap.close()

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight)

  // 2. 核心编码逻辑 (支持针对目标体积的简单迭代)
  const runEncode = async (currentQuality: number): Promise<ArrayBuffer> => {
    const quality100 = Math.max(1, Math.min(100, Math.round(currentQuality * 100)))
    switch (format) {
      case 'image/avif': {
        const { encode } = await import('@jsquash/avif')
        return await encode(imageData, { quality: quality100 })
      }
      case 'image/jxl': {
        const { encode } = await import('@jsquash/jxl')
        return await encode(imageData, {
          quality: quality100,
          effort: options.effort || 7
        })
      }
      case 'image/webp': {
        const { encode } = await import('@jsquash/webp')
        return await encode(imageData, { quality: quality100 })
      }
      case 'image/jpeg':
      case 'image/jpeg-li': {
        const { encode } = await import('@jsquash/jpeg')
        return await encode(imageData, { quality: quality100 })
      }
      case 'image/png': {
        const { encode } = await import('@jsquash/png')
        if (options.colors && options.colors < 256) {
          const depth = Math.max(1, Math.round(Math.log2(options.colors)))
          const factor = 256 / Math.pow(2, depth)

          const data = imageData.data
          if (data) {
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.round((data[i] as number) / factor) * factor
              data[i + 1] = Math.round((data[i + 1] as number) / factor) * factor
              data[i + 2] = Math.round((data[i + 2] as number) / factor) * factor
              if ((data[i + 3] as number) < 128) data[i + 3] = 0
              else data[i + 3] = 255
            }
          }
        }
        return await encode(imageData)
      }
      default:
        throw new Error(`Wasm 引擎暂时不支持导出此格式: ${format}`)
    }
  }

  let arrayBuffer: ArrayBuffer
  let currentQuality = options.quality

  if (options.maxSizeMB && format !== 'image/png') {
    const targetSize = options.maxSizeMB * 1024 * 1024
    let attempt = 0
    arrayBuffer = await runEncode(currentQuality)

    while (arrayBuffer.byteLength > targetSize && attempt < 3) {
      attempt++
      currentQuality = currentQuality * (targetSize / arrayBuffer.byteLength) * 0.9
      if (currentQuality < 0.1) break
      arrayBuffer = await runEncode(currentQuality)
    }
  } else {
    arrayBuffer = await runEncode(currentQuality)
  }

  if (options.preserveExif && file instanceof File) {
    arrayBuffer = await injectMetadata(file, arrayBuffer, format)
  }

  const outputMime = format === 'image/jpeg-li' ? 'image/jpeg' : format
  const compressedBlob = new Blob([arrayBuffer], { type: outputMime })

  if (
    shouldKeepOriginalWhenLarger(
      options.keepOriginalIfLarger,
      file.type,
      outputMime,
      compressedBlob.size,
      file.size
    )
  ) {
    return {
      blob: file,
      size: file.size,
      skipped: true
    }
  }

  return {
    blob: compressedBlob,
    size: compressedBlob.size
  }
}
