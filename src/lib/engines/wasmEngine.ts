import type { ImageProcessor } from './types'
import type { CompressionOptions } from './compressEngine'
import { injectMetadata } from '../utils/metadata'

/**
 * WebAssembly 核心图片处理引擎
 * 利用 jSquash 底层 C/C++/Rust 编解码器在纯前端实现浏览器不支持的复杂格式转换 (如 AVIF, JXL)
 */
export const wasmEngine: ImageProcessor<CompressionOptions> = async (file, options) => {
  const format = options.format || file.type

  // 1. 将输入图像快速解析为统一的 RGBA 像素阵列 (ImageData)
  // 并根据 maxWidth/maxHeight 进行预缩放处理
  const bitmap = await createImageBitmap(file)
  let targetWidth = bitmap.width
  let targetHeight = bitmap.height

  if (options.maxWidth || options.maxHeight) {
    const ratio = bitmap.width / bitmap.height
    if (options.maxWidth && targetWidth > options.maxWidth) {
      targetWidth = options.maxWidth
      targetHeight = targetWidth / ratio
    }
    if (options.maxHeight && targetHeight > options.maxHeight) {
      targetHeight = options.maxHeight
      targetWidth = targetHeight * ratio
    }
  }

  const canvas = new OffscreenCanvas(targetWidth, targetHeight)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建离屏 Canvas 上下文')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
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
        // 如果用户设置了较低的颜色数 (2-255)，我们可以通过颜色步进模拟索引色量化
        if (options.colors && options.colors < 256) {
          const depth = Math.max(1, Math.round(Math.log2(options.colors)))
          const factor = 256 / Math.pow(2, depth)

          const data = imageData.data
          if (data) {
            for (let i = 0; i < data.length; i += 4) {
              // 对 RGB 通道进行量化处理
              data[i] = Math.round((data[i] as number) / factor) * factor
              data[i + 1] = Math.round((data[i + 1] as number) / factor) * factor
              data[i + 2] = Math.round((data[i + 2] as number) / factor) * factor
              // Alpha 通道通常保持原样或进行二值化处理
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

  // 如果指定了目标体积 (maxSizeMB)，进行最多 3 次迭代尝试
  if (options.maxSizeMB && format !== 'image/png') {
    const targetSize = options.maxSizeMB * 1024 * 1024
    let attempt = 0
    arrayBuffer = await runEncode(currentQuality)

    while (arrayBuffer.byteLength > targetSize && attempt < 3) {
      attempt++
      // 简单的线性下降尝试，加入 0.9 的安全系数
      currentQuality = currentQuality * (targetSize / arrayBuffer.byteLength) * 0.9
      if (currentQuality < 0.1) break
      arrayBuffer = await runEncode(currentQuality)
    }
  } else {
    arrayBuffer = await runEncode(currentQuality)
  }

  // 3. 将 Wasm 吐出的 ArrayBuffer 包装为 Blob (如果需要，先缝合元数据)
  if (options.preserveExif && file instanceof File) {
    arrayBuffer = await injectMetadata(file, arrayBuffer, format)
  }

  const outputMime = format === 'image/jpeg-li' ? 'image/jpeg' : format
  const compressedBlob = new Blob([arrayBuffer], { type: outputMime })

  // 4. 判断是否保留原图（防倒车机制）
  const shouldKeepOriginal = options.keepOriginalIfLarger !== false // 默认 true
  if (shouldKeepOriginal && compressedBlob.size >= file.size) {
    return {
      blob: file,
      size: file.size
    }
  }

  return {
    blob: compressedBlob,
    size: compressedBlob.size
  }
}
