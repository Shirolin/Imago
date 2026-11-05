import { AutoModel, AutoProcessor, RawImage, env, pipeline } from '@huggingface/transformers'
import { refineMaskAlpha } from './maskRefine'
import { removeBackgroundResidue } from './backgroundResidue'
import { computeLetterbox, cropMaskAlpha, type LetterboxRect } from './letterbox'

// 所有推理都在本 Worker 内完成；禁止回读本地文件系统
env.allowLocalModels = false

export type BgRemoveTier = 'smart' | 'pro'

interface TierConfig {
  id: string
  kind: 'pipeline' | 'manual'
  gpuDtype: 'fp16' | 'fp32'
  cpuDtype: 'q8' | 'fp32'
  /** 指定 ONNX 文件名（不含 .onnx），需配合 fp32 dtype（无文件名后缀） */
  gpuFile?: string
}

/**
 * smart: ORMBG（ISNet 架构重训，Apache-2.0）量化后 42MB，替代 AGPL 的 imgly。
 * pro:   BiRefNet-lite（MIT）fp16 123MB，边缘指标优于 ISNet 全量。
 *
 * 用 wonfy 的 WebGPU 重写版而非 onnx-community 原版：原版 decoder 的 Split
 * 需要 17 个 storage buffer，超过 Dawn 上限 16，WebGPU 推理直接失败。
 * 该版本把 Split/Concat 拆成 ≤6 输入的小树，权重与数学不变（MIT）。
 * fp16 文件保持 fp32 IO，所以 dtype 传 fp32、文件名显式指定。
 */
const TIERS: Record<BgRemoveTier, TierConfig> = {
  smart: {
    id: 'onnx-community/ormbg-ONNX',
    kind: 'pipeline',
    gpuDtype: 'fp16',
    cpuDtype: 'q8'
  },
  pro: {
    id: 'wonfy/BiRefNet_lite-ONNX-webgpu',
    kind: 'manual',
    gpuDtype: 'fp32',
    gpuFile: 'model_fp16',
    // WASM 下 fp16 算子支持不稳定，退回 fp32
    cpuDtype: 'fp32'
  }
}

interface WorkerOptions {
  model?: BgRemoveTier
  usePreScaling?: boolean
  maskThreshold?: number
  maskBlur?: number
  maskShrink?: number
  cleanResidue?: boolean
  jobId?: string
  format?: string
  quality?: number
}

interface WorkerMessage {
  requestId: string
  type?: 'infer' | 'preload'
  file?: File | Blob
  model?: BgRemoveTier
  options?: WorkerOptions
}

interface LoadedModel {
  tier: BgRemoveTier
  device: 'webgpu' | 'wasm'
  dtype: string
  pipe?: unknown
  model?: unknown
  processor?: unknown
}

interface MaskCacheEntry {
  alpha: Uint8ClampedArray
  width: number
  height: number
  tier: BgRemoveTier
}

// 缓存池：JobID -> 原始 AI 遮罩 alpha，供滑杆实时精修
const maskCache = new Map<string, MaskCacheEntry>()
const loadedModels = new Map<BgRemoveTier, LoadedModel>()
const loadingModels = new Map<BgRemoveTier, Promise<LoadedModel>>()

let webgpuSupport: Promise<boolean> | null = null

const detectWebGPU = () => {
  if (!webgpuSupport) {
    webgpuSupport = (async () => {
      // @ts-expect-error - navigator.gpu 不在标准 Worker 类型中
      const gpu = self.navigator.gpu as
        { requestAdapter: () => Promise<unknown | null> } | undefined
      if (!gpu) return false
      try {
        return (await gpu.requestAdapter()) !== null
      } catch {
        return false
      }
    })()
  }
  return webgpuSupport
}

const loadModel = (tier: BgRemoveTier, onProgress: (value: number) => void) => {
  const cached = loadedModels.get(tier)
  if (cached) return Promise.resolve(cached)
  const pending = loadingModels.get(tier)
  if (pending) return pending

  const task = (async (): Promise<LoadedModel> => {
    const config = TIERS[tier]
    const device = (await detectWebGPU()) ? 'webgpu' : 'wasm'
    const dtype = device === 'webgpu' ? config.gpuDtype : config.cpuDtype

    // 多文件下载的进度聚合：按已发现的文件取平均
    const fileProgress = new Map<string, number>()
    const progressCallback = (event: {
      status: string
      file?: string
      loaded?: number
      total?: number
    }) => {
      const file = event.file || 'model'
      if (event.status === 'progress' && event.total) {
        fileProgress.set(file, event.loaded! / event.total)
      } else if (event.status === 'done') {
        fileProgress.set(file, 1)
      }
      if (fileProgress.size === 0) return
      let sum = 0
      for (const value of fileProgress.values()) sum += value
      onProgress(Math.min(0.99, sum / fileProgress.size))
    }

    const loaded: LoadedModel = { tier, device, dtype }
    if (config.kind === 'pipeline') {
      loaded.pipe = await pipeline('background-removal', config.id, {
        device,
        dtype,
        progress_callback: progressCallback
      })
    } else {
      loaded.processor = await AutoProcessor.from_pretrained(config.id, {
        progress_callback: progressCallback
      })
      loaded.model = await AutoModel.from_pretrained(config.id, {
        device,
        dtype,
        ...(device === 'webgpu' && config.gpuFile ? { model_file_name: config.gpuFile } : {}),
        progress_callback: progressCallback
      })
    }
    loadedModels.set(tier, loaded)
    return loaded
  })()

  loadingModels.set(tier, task)
  task.finally(() => loadingModels.delete(tier))
  return task
}

/**
 * 模型输入固定 1024 正方形。等比缩放 + 边缘延展留白，避免非方形图被拉伸；
 * 留白区用边界像素延展，模型不会看到硬色边框。推理后按 content 矩形裁回。
 */
const MODEL_INPUT_SIZE = 1024

interface PreparedInput {
  blob: File | Blob
  /** null 表示没能做 letterbox，遮罩不做裁剪 */
  content: LetterboxRect | null
}

const letterboxInput = async (
  file: File | Blob,
  width: number,
  height: number
): Promise<PreparedInput> => {
  const content = computeLetterbox(width, height, MODEL_INPUT_SIZE)
  const canvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
  const ctx = canvas.getContext('2d')
  if (!ctx) return { blob: file, content: null }

  const bitmap = await createImageBitmap(file)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height, content.x, content.y, content.width, content.height)

  // 左右留白：把最外一列像素横向拉伸；上下留白同理
  if (content.x > 0) {
    ctx.drawImage(bitmap, 0, 0, 1, height, 0, content.y, content.x, content.height)
    ctx.drawImage(
      bitmap,
      width - 1,
      0,
      1,
      height,
      content.x + content.width,
      content.y,
      content.x,
      content.height
    )
  }
  if (content.y > 0) {
    ctx.drawImage(bitmap, 0, 0, width, 1, 0, 0, MODEL_INPUT_SIZE, content.y)
    ctx.drawImage(
      bitmap,
      0,
      height - 1,
      width,
      1,
      0,
      content.y + content.height,
      MODEL_INPUT_SIZE,
      content.y
    )
  }
  bitmap.close()

  return { blob: await canvas.convertToBlob({ type: 'image/png' }), content }
}

/** 统一的遮罩结果：alpha 通道 + 尺寸 */
const predictMask = async (loaded: LoadedModel, file: File | Blob) => {
  const image = await RawImage.fromBlob(file)

  if (loaded.pipe) {
    const result = await (loaded.pipe as (input: RawImage) => Promise<unknown>)(image)
    const out = (Array.isArray(result) ? result[0] : result) as RawImage
    const alpha = new Uint8ClampedArray(out.width * out.height)
    const channels = out.channels
    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = channels === 4 ? out.data[i * 4 + 3]! : out.data[i]!
    }
    return { alpha, width: out.width, height: out.height }
  }

  const inputs = await (loaded.processor as (input: RawImage) => Promise<Record<string, unknown>>)(
    image
  )
  const outputs = (await (loaded.model as (input: Record<string, unknown>) => Promise<unknown>)({
    input_image: inputs.pixel_values
  })) as { output_image: { data: Float32Array; dims: number[] } }

  const tensor = outputs.output_image
  const height = tensor.dims[2]!
  const width = tensor.dims[3]!
  const alpha = new Uint8ClampedArray(width * height)
  for (let i = 0; i < alpha.length; i++) {
    const logit = tensor.data[i]!
    // 背景零截断：Sigmoid(-8) 约 0.0003，取整后本来就是 0，提前跳过省掉 exp
    alpha[i] = logit <= -8 ? 0 : Math.round(255 / (1 + Math.exp(-logit)))
  }
  return { alpha, width, height }
}

/** 把原图缩到遮罩尺寸，供残留清理做颜色参考；遮罩与原图比例一致，直接缩放即可 */
const buildGuideImage = async (file: File | Blob, width: number, height: number) => {
  const bitmap = await createImageBitmap(file)
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return null
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height).data
  bitmap.close()
  return data
}

const runPreload = async (message: WorkerMessage) => {
  const { requestId, model = 'smart' } = message
  try {
    await loadModel(model, (value) => {
      self.postMessage({ requestId, type: 'preload-progress', value })
    })
    self.postMessage({ requestId, type: 'preload-done' })
  } catch (error) {
    const err = error as Error
    self.postMessage({ requestId, type: 'error', message: err.message || '模型加载失败' })
  }
}

const runInference = async (message: WorkerMessage) => {
  const { requestId } = message
  const file = message.file!
  const options = message.options || {}
  const {
    usePreScaling = true,
    model: tier = 'smart',
    maskThreshold = 0,
    maskBlur = 0,
    maskShrink = 0,
    cleanResidue = false,
    jobId,
    format,
    quality
  } = options

  try {
    const originalBitmap = await createImageBitmap(file)
    const originalWidth = originalBitmap.width
    const originalHeight = originalBitmap.height
    originalBitmap.close()

    let mask = jobId ? maskCache.get(jobId) : undefined
    if (mask && mask.tier !== tier) {
      maskCache.delete(jobId!)
      mask = undefined
    }

    if (!mask) {
      const loaded = await loadModel(tier, (value) => {
        self.postMessage({ requestId, type: 'progress', value: value * 0.5 })
      })
      self.postMessage({ requestId, type: 'progress', value: 0.6 })

      let inferenceFile: File | Blob = file
      let content: LetterboxRect | null = null
      if (usePreScaling) {
        const prepared = await letterboxInput(file, originalWidth, originalHeight)
        inferenceFile = prepared.blob
        content = prepared.content
      }
      const predicted = await predictMask(loaded, inferenceFile)
      const cropped = content
        ? cropMaskAlpha(
            predicted.alpha,
            predicted.width,
            predicted.height,
            content,
            MODEL_INPUT_SIZE
          )
        : predicted
      mask = { ...cropped, tier }

      if (jobId) {
        if (maskCache.size >= 10) {
          const firstKey = maskCache.keys().next().value
          if (firstKey !== undefined) maskCache.delete(firstKey)
        }
        maskCache.set(jobId, mask)
      }
    }

    self.postMessage({ requestId, type: 'progress', value: 0.85 })

    // 可选后处理：清掉与透明区连通的背景色残留（如贴着物体的墙面阴影）
    let maskAlpha = mask.alpha
    if (cleanResidue) {
      const guide = await buildGuideImage(file, mask.width, mask.height)
      if (guide) {
        maskAlpha = removeBackgroundResidue(mask.alpha, {
          data: guide,
          width: mask.width,
          height: mask.height
        })
      }
    }

    // 在模型原生分辨率上精修 alpha，再放大到原图
    const maskImage = new ImageData(mask.width, mask.height)
    for (let i = 0; i < maskAlpha.length; i++) {
      const j = i * 4
      maskImage.data[j] = 255
      maskImage.data[j + 1] = 255
      maskImage.data[j + 2] = 255
      maskImage.data[j + 3] = refineMaskAlpha(maskAlpha[i]!, maskThreshold, maskShrink)
    }

    const maskCanvas = new OffscreenCanvas(mask.width, mask.height)
    const mCtx = maskCanvas.getContext('2d')
    if (!mCtx) throw new Error('无法创建遮罩上下文')
    mCtx.putImageData(maskImage, 0, 0)

    // 放大 + 平滑：blur 只作用于 alpha 边缘，放在最终分辨率上执行
    const scaledMaskCanvas = new OffscreenCanvas(originalWidth, originalHeight)
    const sCtx = scaledMaskCanvas.getContext('2d')
    if (!sCtx) throw new Error('无法创建合成上下文')
    sCtx.imageSmoothingEnabled = true
    sCtx.imageSmoothingQuality = 'high'
    if (maskBlur > 0) sCtx.filter = `blur(${maskBlur}px)`
    sCtx.drawImage(maskCanvas, 0, 0, originalWidth, originalHeight)

    const finalCanvas = new OffscreenCanvas(originalWidth, originalHeight)
    const finalCtx = finalCanvas.getContext('2d')
    if (!finalCtx) throw new Error('无法创建合成上下文')
    const originalImage = await createImageBitmap(file)
    finalCtx.drawImage(originalImage, 0, 0)
    finalCtx.globalCompositeOperation = 'destination-in'
    finalCtx.drawImage(scaledMaskCanvas, 0, 0)
    originalImage.close()

    // 导出格式透传：'original' 保留 PNG 语义（抠图结果含透明通道）
    const outType = !format || format === 'original' ? 'image/png' : format
    const finalBlob = await finalCanvas.convertToBlob({ type: outType, quality })
    if (!finalBlob) throw new Error('图像生成失败')

    self.postMessage({ requestId, type: 'done', blob: finalBlob })
  } catch (error) {
    const err = error as Error
    self.postMessage({ requestId, type: 'error', message: err.message || '未知错误' })
  }
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  if (event.data.type === 'preload') {
    await runPreload(event.data)
    return
  }
  await runInference(event.data)
}
