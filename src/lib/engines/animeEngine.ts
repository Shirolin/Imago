import * as ort from 'onnxruntime-web'
import type { ImageProcessor } from './types'

export interface AnimeOptions {
  format?: string
  quality?: number
  modelUrl?: string
  usePreScaling?: boolean
  maskThreshold?: number // 边缘偏移 (-1 to 1)
  maskBlur?: number // 边缘平滑 (0 to 20)
  alphaRecovery?: number // 线条恢复 (0 to 1)
  denoise?: number // 杂色去除 (0 to 10)
}

// 缓存模型实例（内存级）
let session: ort.InferenceSession | null = null

// --- IndexedDB 缓存逻辑 ---
const DB_NAME = 'imago-models-cache'
const STORE_NAME = 'models'
const MODEL_KEY = 'isnet-anime-v1'

async function getCachedModel(): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const getReq = store.get(MODEL_KEY)
        getReq.onsuccess = () => resolve(getReq.result || null)
        getReq.onerror = () => resolve(null)
      }
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function cacheModel(buffer: ArrayBuffer) {
  try {
    const request = indexedDB.open(DB_NAME, 1)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(buffer, MODEL_KEY)
    }
  } catch (e) {
    console.warn('[Anime Engine] Failed to cache model to IndexedDB:', e)
  }
}
// -----------------------

// 配置 WASM 路径
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/'

/**
 * ISNet-Anime 二次元专业抠图引擎 (支持深度微调)
 */
export const animeEngine: ImageProcessor<AnimeOptions> = async (file, options) => {
  console.log('[Imago Engine] 🌸 Starting Anime Removal', options)

  const {
    usePreScaling = true,
    maskThreshold = 0,
    maskBlur = 0,
    alphaRecovery = 0,
    denoise = 0
  } = options

  try {
    const originalBitmap = await createImageBitmap(file)
    const { width: originalWidth, height: originalHeight } = originalBitmap

    if (!session) {
      console.log('[Anime Engine] Checking local IndexedDB cache...')
      let modelBuffer = await getCachedModel()

      if (modelBuffer) {
        console.log('[Anime Engine] Found cached model (176MB), skipping download.')
        if (options.onProgress) options.onProgress(0.5)
      } else {
        const modelUrl = 'https://huggingface.co/fofr/comfyui/resolve/main/rembg/isnet-anime.onnx'
        console.log('[Anime Engine] Cache miss. Fetching model from HF:', modelUrl)

        const response = await fetch(modelUrl, { method: 'GET', credentials: 'omit', mode: 'cors' })
        if (!response.ok) throw new Error(`模型下载失败: ${response.status}`)

        const contentLength = response.headers.get('content-length')
        const total = contentLength ? parseInt(contentLength, 10) : 0
        const reader = response.body?.getReader()
        if (!reader) throw new Error('无法读取下载流')

        let loaded = 0
        const chunks: Uint8Array[] = []
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value!)
          loaded += value!.length
          if (total > 0 && options.onProgress) options.onProgress((loaded / total) * 0.8)
        }

        const fullBuffer = new Uint8Array(loaded)
        let offset = 0
        for (const chunk of chunks) {
          fullBuffer.set(chunk, offset)
          offset += chunk.length
        }
        modelBuffer = fullBuffer.buffer
        cacheModel(modelBuffer)
      }

      session = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      })
      console.log('[Anime Engine] Model ready')
    }

    // 1. 推理预处理：ISNet 固定输入 1024x1024
    const SIZE = 1024
    const canvas = new OffscreenCanvas(SIZE, SIZE)
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(originalBitmap, 0, 0, SIZE, SIZE)
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE)

    const input = new Float32Array(SIZE * SIZE * 3)
    for (let i = 0; i < data.length / 4; i++) {
      input[i] = (data[i * 4]! / 255 - 0.5) / 0.5
      input[i + SIZE * SIZE] = (data[i * 4 + 1]! / 255 - 0.5) / 0.5
      input[i + SIZE * SIZE * 2] = (data[i * 4 + 2]! / 255 - 0.5) / 0.5
    }

    const tensor = new ort.Tensor('float32', input, [1, 3, SIZE, SIZE])

    // 2. 执行 AI 推理
    const results = await session!.run({ img: tensor })
    const outputName = session!.outputNames[0]!
    const output = results[outputName]!.data as Float32Array

    // 3. 后处理：生成原始蒙版
    const lowResMaskCanvas = new OffscreenCanvas(SIZE, SIZE)
    const mCtx = lowResMaskCanvas.getContext('2d')!
    const mData = mCtx.createImageData(SIZE, SIZE)
    for (let i = 0; i < output.length; i++) {
      const alpha = Math.round(output[i]! * 255)
      mData.data[i * 4] = mData.data[i * 4 + 1] = mData.data[i * 4 + 2] = 0
      mData.data[i * 4 + 3] = alpha
    }
    mCtx.putImageData(mData, 0, 0)

    // 4. 高清还原与深度微调
    const finalCanvas = new OffscreenCanvas(originalWidth, originalHeight)
    const finalCtx = finalCanvas.getContext('2d')!

    // 创建增强蒙版层
    const enhancedMaskCanvas = new OffscreenCanvas(originalWidth, originalHeight)
    const eCtx = enhancedMaskCanvas.getContext('2d')!
    eCtx.imageSmoothingEnabled = true
    eCtx.imageSmoothingQuality = 'high'

    // 应用多重滤镜链
    // bVal: 线条恢复与边缘偏移对亮度的综合影响
    const bVal = 1 + alphaRecovery * 0.5 + maskThreshold * 0.2
    // cVal: 基础对比度 + 偏移修正
    const cVal = usePreScaling ? 1 + maskThreshold * 0.2 : 1.8 + maskThreshold * 0.5

    eCtx.filter = `brightness(${bVal}) blur(${maskBlur}px) contrast(${cVal})`
    eCtx.drawImage(lowResMaskCanvas, 0, 0, originalWidth, originalHeight)

    // d. 杂色去除 Pass
    if (denoise > 0) {
      const denoiseCanvas = new OffscreenCanvas(originalWidth, originalHeight)
      const dCtx = denoiseCanvas.getContext('2d')!
      dCtx.filter = `blur(${denoise * 0.4}px) contrast(1.4)`
      dCtx.drawImage(enhancedMaskCanvas, 0, 0)
      eCtx.clearRect(0, 0, originalWidth, originalHeight)
      eCtx.filter = 'none'
      eCtx.drawImage(denoiseCanvas, 0, 0)
    }

    // 5. 最终合成
    finalCtx.drawImage(originalBitmap, 0, 0)
    finalCtx.globalCompositeOperation = 'destination-in'
    finalCtx.drawImage(enhancedMaskCanvas, 0, 0)

    const blob = await finalCanvas.convertToBlob({ type: 'image/png' })
    originalBitmap.close()
    if (options.onProgress) options.onProgress(1.0)
    return blob
  } catch (err) {
    console.error('[Anime Engine] Error:', err)
    throw new Error(`二次元抠图失败: ${(err as Error).message}`)
  }
}
