import type { ImageProcessor } from './types'
import type { CompressionOptions } from './compressEngine'

// 辅助方法：将 File/Blob 解码为 ImageData（利用浏览器原生极速解码）
async function decodeToImageData(file: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(file)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建离屏 Canvas 上下文 (OffscreenCanvas rendering context failed)')
  ctx.drawImage(bitmap, 0, 0)
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
}

/**
 * WebAssembly 核心图片处理引擎
 * 利用 jSquash 底层 C/C++/Rust 编解码器在纯前端实现浏览器不支持的复杂格式转换 (如 AVIF, JXL)
 */
export const wasmEngine: ImageProcessor<CompressionOptions> = async (file, options) => {
  const format = options.format || file.type

  // 1. 将输入图像快速解析为统一的 RGBA 像素阵列 (ImageData)
  const imageData = await decodeToImageData(file)

  let arrayBuffer: ArrayBuffer
  const quality100 = Math.max(1, Math.min(100, Math.round(options.quality * 100)))

  // 2. 根据目标格式，按需动态加载并执行专属的 Wasm 编码器
  switch (format) {
    case 'image/avif': {
      const { encode } = await import('@jsquash/avif')
      arrayBuffer = await encode(imageData, { quality: quality100 })
      break
    }
    case 'image/jxl': {
      const { encode } = await import('@jsquash/jxl')
      arrayBuffer = await encode(imageData, {
        quality: quality100,
        effort: options.effort || 7
      })
      break
    }
    case 'image/webp': {
      const { encode } = await import('@jsquash/webp')
      arrayBuffer = await encode(imageData, { quality: quality100 })
      break
    }
    case 'image/jpeg':
    case 'image/jpeg-li': {
      const { encode } = await import('@jsquash/jpeg')
      arrayBuffer = await encode(imageData, { quality: quality100 })
      break
    }
    case 'image/png': {
      const { encode } = await import('@jsquash/png')
      arrayBuffer = await encode(imageData)
      break
    }
    default:
      throw new Error(`Wasm 引擎暂时不支持导出此格式: ${format}`)
  }

  // 3. 将 Wasm 吐出的 ArrayBuffer 包装为 Blob
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
