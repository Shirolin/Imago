import { removeBackground } from '@imgly/background-removal'
import type { ImageProcessor } from './types'

export interface BgRemoveOptions {
  format?: string
  quality?: number
  isAnime?: boolean // 是否为二次元/插画模式
  usePreScaling?: boolean // 新增：是否启用预缩放（默认启用以平衡性能）
}

/**
 * 使用 @imgly/background-removal 在纯本地执行背景移除操作
 */
export const bgRemoveEngine: ImageProcessor<BgRemoveOptions> = async (file, options) => {
  console.log('[Imago Engine] 🪄 Starting Local Background Removal', options)

  const { usePreScaling = true } = options

  try {
    // 1. 获取原图位图以获取原始尺寸
    const originalBitmap = await createImageBitmap(file)
    const { width: originalWidth, height: originalHeight } = originalBitmap

    // 2. 性能优化：生成推理用的缩放版本
    const MAX_INFERENCE_DIMENSION = 2048
    let inferenceFile: File | Blob = file

    if (
      usePreScaling &&
      (originalWidth > MAX_INFERENCE_DIMENSION || originalHeight > MAX_INFERENCE_DIMENSION)
    ) {
      const ratio = Math.min(
        MAX_INFERENCE_DIMENSION / originalWidth,
        MAX_INFERENCE_DIMENSION / originalHeight
      )
      const targetWidth = Math.round(originalWidth * ratio)
      const targetHeight = Math.round(originalHeight * ratio)

      const canvas = new OffscreenCanvas(targetWidth, targetHeight)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(originalBitmap, 0, 0, targetWidth, targetHeight)
        inferenceFile = await canvas.convertToBlob({ type: 'image/png' })
      }
    }

    // 维护进度
    let maxProgress = 0

    // 3. 调用 AI 引擎（处理低分辨率图）
    const lowResResultBlob = await removeBackground(inferenceFile, {
      progress: (key: string, current: number, total: number) => {
        const p = current / total
        let weightedP = 0
        if (key.includes('fetch')) weightedP = p * 0.3
        else if (key.includes('compute')) weightedP = 0.3 + p * 0.7
        else weightedP = p
        maxProgress = Math.max(maxProgress, weightedP)
        if (options.onProgress) options.onProgress(maxProgress)
      },
      // @ts-expect-error - 兼容性处理
      signal: options.signal
    })

    if (!lowResResultBlob) {
      throw new Error('背景移除引擎未返回任何有效数据')
    }

    // 4. 高清还原与二次元优化
    const lowResBitmap = await createImageBitmap(lowResResultBlob)
    const finalCanvas = new OffscreenCanvas(originalWidth, originalHeight)
    const finalCtx = finalCanvas.getContext('2d')

    if (!finalCtx) {
      lowResBitmap.close()
      originalBitmap.close()
      throw new Error('无法创建高清合成上下文')
    }

    // A. 准备蒙版（如果是二次元模式，需要对蒙版进行硬化处理）
    let maskBitmap: ImageBitmap | HTMLCanvasElement | OffscreenCanvas = lowResBitmap
    if (options.isAnime) {
      // 二次元优化：增加蒙版对比度，使边缘硬朗，减少虚化感
      const maskCanvas = new OffscreenCanvas(originalWidth, originalHeight)
      const mCtx = maskCanvas.getContext('2d')!
      mCtx.imageSmoothingEnabled = true
      mCtx.imageSmoothingQuality = 'high'

      // 应用对比度滤镜来硬化边缘
      // 1.5 - 2.0 的对比度能有效消除 AI 产生的多余半透明像素
      mCtx.filter = 'contrast(1.8) brightness(1.1)'
      mCtx.drawImage(lowResBitmap, 0, 0, originalWidth, originalHeight)
      maskBitmap = maskCanvas
    }

    // B. 合成最终图像
    finalCtx.drawImage(originalBitmap, 0, 0)
    finalCtx.globalCompositeOperation = 'destination-in'
    finalCtx.imageSmoothingEnabled = true
    finalCtx.imageSmoothingQuality = 'high'

    // 如果是二次元模式，maskBitmap 已经是 originalWidth 大小了
    if (options.isAnime) {
      finalCtx.drawImage(maskBitmap, 0, 0)
    } else {
      finalCtx.drawImage(lowResBitmap, 0, 0, originalWidth, originalHeight)
    }

    // 导出最终结果
    const finalBlob = await finalCanvas.convertToBlob({ type: 'image/png' })

    // 释放资源
    lowResBitmap.close()
    originalBitmap.close()

    if (!finalBlob) throw new Error('最终图像生成失败')
    return finalBlob
  } catch (error) {
    const err = error as Error
    if (err.name === 'AbortError') throw error
    console.error('[Imago Engine] Background Removal Failed:', error)
    throw new Error(`背景去除失败: ${err.message || '未知错误'}`)
  }
}
