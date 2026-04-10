import type { ImageProcessor } from './types'
import BgRemoveWorker from './bgRemove.worker?worker'

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
 * 使用 Web Worker 异步执行背景移除操作，避免阻塞主线程
 */
export const bgRemoveEngine: ImageProcessor<BgRemoveOptions> = (file, options) => {
  return new Promise((resolve, reject) => {
    console.log('[Imago Engine] 🪄 Spawning Background Removal Worker', options)

    const worker = new BgRemoveWorker()

    // 处理来自 Worker 的消息
    worker.onmessage = (event: MessageEvent) => {
      const { type, value, blob, message } = event.data

      if (type === 'progress') {
        if (options.onProgress) options.onProgress(value)
      } else if (type === 'done') {
        worker.terminate()
        resolve(blob)
      } else if (type === 'error') {
        worker.terminate()
        reject(new Error(message || 'Worker 内部错误'))
      }
    }

    worker.onerror = (error: ErrorEvent) => {
      console.error('[Imago Engine] Worker Error:', error)
      worker.terminate()
      reject(new Error(`Worker 启动失败: ${error.message}`))
    }

    // 监听中止信号
    if (options.signal) {
      options.signal.addEventListener(
        'abort',
        () => {
          worker.terminate()
          reject(new Error('AbortError'))
        },
        { once: true }
      )
    }

    // 发送任务到 Worker
    worker.postMessage({
      file,
      options: {
        model: options.model,
        usePreScaling: options.usePreScaling,
        maskThreshold: options.maskThreshold,
        maskBlur: options.maskBlur,
        maskShrink: options.maskShrink
      }
    })
  })
}
