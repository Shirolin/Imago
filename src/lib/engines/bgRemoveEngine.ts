import { removeBackground } from '@imgly/background-removal'
import type { ImageProcessor } from './types'

export interface BgRemoveOptions {
  format?: string
  quality?: number
  isAnime?: boolean // 兼容旧版，保留逻辑
  usePreScaling?: boolean
  model?: 'isnet' | 'isnet_fp16' | 'isnet_quint8' // 新增：模型精度选择
  maskThreshold?: number // 新增：边缘严格度 (0-1)
  maskBlur?: number // 新增：平滑度
  maskShrink?: number // 新增：边缘偏移 (0-1)
}

/**
 * 使用 @imgly/background-removal 在纯本地执行背景移除操作
 */
export const bgRemoveEngine: ImageProcessor<BgRemoveOptions> = async (file, options) => {
  console.log('[Imago Engine] 🪄 Starting Local Background Removal', options)

  const {
    usePreScaling = true,
    model = 'isnet_fp16',
    maskThreshold = 0,
    maskBlur = 0,
    maskShrink = 0
  } = options

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

    // 3. 调用 AI 引擎
    const lowResResultBlob = await removeBackground(inferenceFile, {
      model,
      progress: (key: string, current: number, total: number) => {
        const p = current / total
        let weightedP = 0
        if (key.includes('fetch')) weightedP = p * 0.3
        else if (key.includes('compute')) weightedP = 0.3 + p * 0.7
        else weightedP = p
        if (options.onProgress) options.onProgress(weightedP)
      },
      // @ts-expect-error - 兼容处理
      signal: options.signal
    })

    if (!lowResResultBlob) {
      throw new Error('背景移除引擎未返回任何有效数据')
    }

    // 4. 高清还原与精修 (The Refiner)
    const lowResBitmap = await createImageBitmap(lowResResultBlob)
    const finalCanvas = new OffscreenCanvas(originalWidth, originalHeight)
    const finalCtx = finalCanvas.getContext('2d')

    if (!finalCtx) {
      lowResBitmap.close()
      originalBitmap.close()
      throw new Error('无法创建合成上下文')
    }

    // A. 遮罩重写层 (Mask Layer)
    const maskCanvas = new OffscreenCanvas(originalWidth, originalHeight)
    const mCtx = maskCanvas.getContext('2d')!
    mCtx.imageSmoothingEnabled = true
    mCtx.imageSmoothingQuality = 'high'

    /**
     * 【精修核心：Canvas Filter 算法】
     * 1. contrast: 提高边缘硬度。当数值 > 1 时，半透明区域（支架残影）会由于置信度不足被强制“切断”为透明。
     * 2. brightness: 与 contrast 配合调整。降低亮度可以配合高对比度实现“向内挤压”的效果。
     * 3. blur: 实现平滑。
     */
    // 基础参数计算
    const contrast = 1.0 + maskThreshold * 4.0 // 严格度映射到对比度 (1.0 -> 5.0)
    const brightness = 1.0 - maskShrink * 0.5 // 收缩度映射到亮度偏置
    const blur = maskBlur

    mCtx.filter = `blur(${blur}px) contrast(${contrast}) brightness(${brightness})`
    mCtx.drawImage(lowResBitmap, 0, 0, originalWidth, originalHeight)

    // B. 合成最终图像
    finalCtx.drawImage(originalBitmap, 0, 0)
    finalCtx.globalCompositeOperation = 'destination-in'
    finalCtx.drawImage(maskCanvas, 0, 0)

    // 导出结果
    const finalBlob = await finalCanvas.convertToBlob({ type: 'image/png' })

    lowResBitmap.close()
    originalBitmap.close()

    if (!finalBlob) throw new Error('图像生成失败')
    return finalBlob
  } catch (error) {
    const err = error as Error
    if (err.name === 'AbortError') throw error
    console.error('[Imago Engine] Background Removal Failed:', error)
    throw new Error(`背景去除失败: ${err.message || '未知错误'}`)
  }
}
