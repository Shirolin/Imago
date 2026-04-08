import * as ort from 'onnxruntime-web'
import type { ImageProcessor } from './types'

export interface AnimeOptions {
  format?: string
  quality?: number
  modelUrl?: string
}

// 缓存模型实例
let session: ort.InferenceSession | null = null

// 配置 WASM 路径：指向 jsDelivr 提供的官方镜像，解决本地 MIME 类型报错
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/'

/**
 * ISNet-Anime 二次元专业抠图引擎
 */
export const animeEngine: ImageProcessor<AnimeOptions> = async (file, options) => {
  console.log('[Imago Engine] 🌸 Starting Anime Removal')

  try {
    const originalBitmap = await createImageBitmap(file)
    const { width: originalWidth, height: originalHeight } = originalBitmap

    if (!session) {
      // 终极稳定方案：使用 ComfyUI 生态中经过验证的高可用 Hugging Face 链接
      // 真实模型大小约为 176MB，支持跨域 (CORS) 且无需身份验证
      const modelUrl =
        options.modelUrl ||
        'https://huggingface.co/fofr/comfyui/resolve/main/rembg/isnet-anime.onnx'

      console.log('[Anime Engine] Fetching model from HF:', modelUrl)

      const response = await fetch(modelUrl, {
        method: 'GET',
        credentials: 'omit', // 必须省略凭据，否则 LFS 重定向时会导致 401
        mode: 'cors'
      })

      if (!response.ok) {
        throw new Error(`模型下载失败: ${response.status} ${response.statusText}`)
      }

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
        if (total > 0 && options.onProgress) {
          options.onProgress((loaded / total) * 0.8)
        }
      }

      const modelBuffer = new Uint8Array(loaded)
      let offset = 0
      for (const chunk of chunks) {
        modelBuffer.set(chunk, offset)
        offset += chunk.length
      }

      session = await ort.InferenceSession.create(modelBuffer.buffer, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      })
      console.log('[Anime Engine] Model initialized successfully')
    }

    // 预处理
    const SIZE = 1024
    const canvas = new OffscreenCanvas(SIZE, SIZE)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(originalBitmap, 0, 0, SIZE, SIZE)
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE)

    const input = new Float32Array(SIZE * SIZE * 3)
    for (let i = 0; i < data.length / 4; i++) {
      input[i] = (data[i * 4]! / 255 - 0.5) / 0.5
      input[i + SIZE * SIZE] = (data[i * 4 + 1]! / 255 - 0.5) / 0.5
      input[i + SIZE * SIZE * 2] = (data[i * 4 + 2]! / 255 - 0.5) / 0.5
    }

    const tensor = new ort.Tensor('float32', input, [1, 3, SIZE, SIZE])

    // 修正：ISNet-Anime 模型要求的输入节点名称通常是 'img'
    const results = await session!.run({ img: tensor })

    // 获取第一个输出节点的数据
    const outputName = session!.outputNames[0]!
    const output = results[outputName]!.data as Float32Array

    // 生成蒙版
    const maskCanvas = new OffscreenCanvas(SIZE, SIZE)
    const mCtx = maskCanvas.getContext('2d')!
    const mData = mCtx.createImageData(SIZE, SIZE)
    for (let i = 0; i < output.length; i++) {
      const alpha = Math.round(output[i]! * 255)
      mData.data[i * 4] = mData.data[i * 4 + 1] = mData.data[i * 4 + 2] = 0
      mData.data[i * 4 + 3] = alpha
    }
    mCtx.putImageData(mData, 0, 0)

    // 合成输出
    const finalCanvas = new OffscreenCanvas(originalWidth, originalHeight)
    const finalCtx = finalCanvas.getContext('2d')!
    finalCtx.drawImage(originalBitmap, 0, 0)
    finalCtx.globalCompositeOperation = 'destination-in'
    finalCtx.imageSmoothingEnabled = true
    finalCtx.imageSmoothingQuality = 'high'
    finalCtx.drawImage(maskCanvas, 0, 0, originalWidth, originalHeight)

    const blob = await finalCanvas.convertToBlob({ type: 'image/png' })
    originalBitmap.close()
    if (options.onProgress) options.onProgress(1.0)
    return blob
  } catch (err) {
    console.error('[Anime Engine] Error:', err)
    throw new Error(`二次元抠图失败: ${(err as Error).message}`)
  }
}
