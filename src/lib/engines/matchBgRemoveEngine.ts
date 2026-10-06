import type { ImageProcessor, ProcessResult } from './types'
import { AbortError, onAbort, throwIfAborted } from './abort'

export interface MatchBgRemoveOptions {
  targetColor?: { r: number; g: number; b: number }
  tolerance?: number // 0 to 1
  feather?: number // 0 to 1
  format?: string
  quality?: number
}

/**
 * 纯算法驱动的背景移除：基于感知色彩距离（Lab 空间）
 * 相比 RGB 欧氏距离，Lab 空间更符合人类视觉，对背景阴影和高光容忍度更高
 */
export const matchBgRemoveEngine: ImageProcessor<MatchBgRemoveOptions> = async (file, options) => {
  console.log('[Imago Engine] 🎨 Starting Perceptual Match Background Removal (Worker)')

  const { tolerance = 0.15, feather = 0.1 } = options

  // 中止从解码阶段就生效。此前只在 worker 阶段（下方）挂钩，
  // 而解码 + getImageData 在大图上是耗时的：用户点「中止」后仍要
  // 等到这里才生效，用户看到的是按钮点了没反应。
  const signal = options.signal
  if (signal?.aborted) throw new AbortError()

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader()
    const release = onAbort(signal, () => {
      // reader 无法中止，但可以立即结束等待；解绑后迟到的回调被忽略
      reject(new AbortError())
    })
    reader.onload = () => {
      const i = new Image()
      const releaseImg = onAbort(signal, () => {
        i.src = ''
        reject(new AbortError())
      })
      i.onload = () => {
        release()
        releaseImg()
        resolve(i)
      }
      i.onerror = () => {
        release()
        releaseImg()
        reject(new Error('Failed to load image'))
      }
      i.src = reader.result as string
    }
    reader.onerror = () => {
      release()
      reject(new Error('Failed to read image'))
    }
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

  // getImageData 之后、worker 挂上之前的空窗也要能被中止
  throwIfAborted(signal)

  // 使用 Web Worker 进行像素级计算，防止主线程卡顿
  const processedData = await new Promise<ArrayBuffer>((resolve, reject) => {
    const worker = new Worker(new URL('./matchWorker.ts', import.meta.url), {
      type: 'module'
    })

    let settled = false
    let releaseAbort = () => {}
    const cleanup = () => {
      releaseAbort()
      clearTimeout(timeoutId)
    }
    const abortTask = () => {
      if (settled) return
      settled = true
      cleanup()
      worker.terminate()
      reject(new AbortError())
    }
    // 长任务兜底：像素级计算单张超过 120s 判定失败
    const timeoutId = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      worker.terminate()
      reject(new Error('处理超时（120 秒）'))
    }, 120_000)

    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        if (options.onProgress) options.onProgress(e.data.progress)
      } else if (e.data.type === 'done') {
        if (settled) return
        settled = true
        cleanup()
        resolve(e.data.pixels)
        worker.terminate()
      }
    }

    worker.onerror = (err) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
      worker.terminate()
    }

    // onAbort 内含「signal 已中止则立即回调」，无需再单独判断 aborted
    releaseAbort = onAbort(signal, abortTask)
    if (settled) return

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
  throwIfAborted(signal)
  const finalImageData = new ImageData(new Uint8ClampedArray(processedData), width, height)
  ctx.putImageData(finalImageData, 0, 0)

  return new Promise<ProcessResult>((resolve, reject) => {
    // 'original' 保留 PNG 语义（抠图结果含透明通道）
    const outType = !options.format || options.format === 'original' ? 'image/png' : options.format
    const release = onAbort(signal, () => reject(new AbortError()))
    canvas.toBlob(
      (blob) => {
        release()
        // 包成 ProcessResult：此前 resolve(blob) 与声明的 Promise<ProcessResult> 不符
        if (blob) resolve({ blob, size: blob.size, width, height })
        else reject(new Error('Canvas toBlob failed'))
      },
      outType,
      options.quality
    )
  })
}
