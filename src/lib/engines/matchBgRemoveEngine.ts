import type { ImageProcessor } from './types'

export interface MatchBgRemoveOptions {
  targetColor?: { r: number; g: number; b: number }
  tolerance?: number // 0 to 1
  feather?: number // 0 to 1
}

/**
 * 纯算法驱动的背景移除：基于感知色彩距离（Lab 空间）
 * 相比 RGB 欧氏距离，Lab 空间更符合人类视觉，对背景阴影和高光容忍度更高
 */
export const matchBgRemoveEngine: ImageProcessor<MatchBgRemoveOptions> = async (file, options) => {
  console.log('[Imago Engine] 🎨 Starting Perceptual Match Background Removal (Worker)')

  const { tolerance = 0.15, feather = 0.1 } = options

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const width = img.width
  const height = img.height
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, width, height)

  // 采样目标背景色（默认左上角）
  const pixels = imageData.data
  const targetColor = options.targetColor || {
    r: pixels[0]!,
    g: pixels[1]!,
    b: pixels[2]!
  }

  // 使用 Web Worker 进行像素级计算，防止主线程卡顿
  const processedData = await new Promise<ArrayBuffer>((resolve, reject) => {
    const worker = new Worker(new URL('./matchWorker.ts', import.meta.url), {
      type: 'module'
    })

    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        if (options.onProgress) options.onProgress(e.data.progress)
      } else if (e.data.type === 'done') {
        resolve(e.data.pixels)
        worker.terminate()
      }
    }

    worker.onerror = (err) => {
      reject(err)
      worker.terminate()
    }

    // 传输模式：将像素数组以可转移对象（Transferable Objects）形式发给 Worker
    // 这避免了内存复制，极大提升了大图处理性能
    const pixelBuffer = imageData.data.buffer
    worker.postMessage(
      {
        pixels: pixelBuffer,
        targetColor,
        tolerance,
        feather
      },
      [pixelBuffer]
    )
  })

  // 将处理后的数据写回 Canvas
  const finalImageData = new ImageData(new Uint8ClampedArray(processedData), width, height)
  ctx.putImageData(finalImageData, 0, 0)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })
}
