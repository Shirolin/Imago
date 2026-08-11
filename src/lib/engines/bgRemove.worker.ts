import { removeBackground } from '@imgly/background-removal'

interface WorkerOptions {
  model?: 'isnet' | 'isnet_fp16' | 'isnet_quint8'
  usePreScaling?: boolean
  maskThreshold?: number
  maskBlur?: number
  maskShrink?: number
  jobId?: string
  format?: string
  quality?: number
}

interface WorkerMessage {
  requestId: string
  file: File | Blob
  options: WorkerOptions
}

// 缓存池：JobID -> { bitmap: 原始 AI 遮罩位图, model: 产生该遮罩的模型名称 }
const maskCache = new Map<string, { bitmap: ImageBitmap; model: string }>()

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { requestId, file, options } = event.data
  const {
    usePreScaling = true,
    model = 'isnet_fp16',
    maskThreshold = 0,
    maskBlur = 0,
    maskShrink = 0,
    jobId,
    format,
    quality
  } = options

  try {
    let lowResBitmap: ImageBitmap | null = null
    let originalWidth = 0
    let originalHeight = 0

    // 1. 尝试从缓存中获取已有的 AI 遮罩结果
    if (jobId && maskCache.has(jobId)) {
      const entry = maskCache.get(jobId)!
      // 只有模型精度一致时，缓存才有效
      if (entry.model === model) {
        console.log(`[Worker] ⚡ Cache Hit for Job ${jobId}, skipping AI inference.`)
        lowResBitmap = entry.bitmap

        // 获取并重置尺寸
        const originalBitmap = await createImageBitmap(file)
        originalWidth = originalBitmap.width
        originalHeight = originalBitmap.height
        originalBitmap.close()
      } else {
        // 模型变了，旧缓存失效
        entry.bitmap.close()
        maskCache.delete(jobId)
      }
    }

    if (!lowResBitmap) {
      // --- 执行完整推理流水线 ---
      const originalBitmap = await createImageBitmap(file)
      originalWidth = originalBitmap.width
      originalHeight = originalBitmap.height

      // 性能优化：生成推理用的缩放版本
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

      // 调用 AI 引擎
      const lowResResultBlob = await removeBackground(inferenceFile, {
        model: model as 'isnet' | 'isnet_fp16' | 'isnet_quint8',
        progress: (key: string, current: number, total: number) => {
          const p = current / total
          let weightedP = 0
          if (key.includes('fetch')) weightedP = p * 0.3
          else if (key.includes('compute')) weightedP = 0.3 + p * 0.7
          else weightedP = p
          self.postMessage({ requestId, type: 'progress', value: weightedP })
        }
      })

      if (!lowResResultBlob) {
        originalBitmap.close()
        throw new Error('背景移除引擎未返回任何有效数据')
      }

      lowResBitmap = await createImageBitmap(lowResResultBlob)

      // 存入缓存
      if (jobId) {
        if (maskCache.size >= 10) {
          const firstKey = maskCache.keys().next().value
          if (firstKey !== undefined) {
            maskCache.get(firstKey)?.bitmap.close()
            maskCache.delete(firstKey)
          }
        }
        maskCache.set(jobId, { bitmap: lowResBitmap, model })
      }
      originalBitmap.close()
    }

    // --- 4. 高清还原与精修 (The Refiner) ---
    const finalCanvas = new OffscreenCanvas(originalWidth, originalHeight)
    const finalCtx = finalCanvas.getContext('2d')

    if (!finalCtx) {
      throw new Error('无法创建合成上下文')
    }

    const maskCanvas = new OffscreenCanvas(originalWidth, originalHeight)
    const mCtx = maskCanvas.getContext('2d')!
    mCtx.imageSmoothingEnabled = true
    mCtx.imageSmoothingQuality = 'high'

    const contrast = 1.0 + maskThreshold * 4.0
    const brightness = 1.0 - maskShrink * 0.5
    const blur = maskBlur

    mCtx.filter = `blur(${blur}px) contrast(${contrast}) brightness(${brightness})`
    mCtx.drawImage(lowResBitmap, 0, 0, originalWidth, originalHeight)

    const originalImage = await createImageBitmap(file)
    finalCtx.drawImage(originalImage, 0, 0)
    finalCtx.globalCompositeOperation = 'destination-in'
    finalCtx.drawImage(maskCanvas, 0, 0)

    // 导出格式透传：'original' 保留 PNG 语义（抠图结果含透明通道）
    const outType = !format || format === 'original' ? 'image/png' : format
    const finalBlob = await finalCanvas.convertToBlob({ type: outType, quality })
    originalImage.close()

    if (!finalBlob) throw new Error('图像生成失败')

    self.postMessage({ requestId, type: 'done', blob: finalBlob })
  } catch (error) {
    const err = error as Error
    self.postMessage({ requestId, type: 'error', message: err.message || '未知错误' })
  }
}
