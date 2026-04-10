import { removeBackground } from '@imgly/background-removal'

interface WorkerOptions {
  model?: 'isnet' | 'isnet_fp16' | 'isnet_quint8'
  usePreScaling?: boolean
  maskThreshold?: number
  maskBlur?: number
  maskShrink?: number
}

interface WorkerMessage {
  file: File | Blob
  options: WorkerOptions
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { file, options } = event.data
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
      model: model as 'isnet' | 'isnet_fp16' | 'isnet_quint8',
      progress: (key: string, current: number, total: number) => {
        const p = current / total
        let weightedP = 0
        if (key.includes('fetch')) weightedP = p * 0.3
        else if (key.includes('compute')) weightedP = 0.3 + p * 0.7
        else weightedP = p

        self.postMessage({ type: 'progress', value: weightedP })
      }
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

    // 发送最终结果
    self.postMessage({ type: 'done', blob: finalBlob })
  } catch (error) {
    const err = error as Error
    self.postMessage({ type: 'error', message: err.message || '未知错误' })
  }
}
