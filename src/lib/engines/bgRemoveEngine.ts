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
  jobId?: string // 新增：用于缓存 AI 遮罩以实现秒级精修
}

let sharedWorker: Worker | null = null

const getWorker = () => {
  if (!sharedWorker) {
    sharedWorker = new BgRemoveWorker()
    console.log('[Imago Engine] 🚀 Initialized Long-lived BgRemove Worker')
  }
  return sharedWorker
}

/**
 * 使用 Web Worker 异步执行背景移除操作，避免阻塞主线程
 */
export const bgRemoveEngine: ImageProcessor<BgRemoveOptions> = (file, options) => {
  return new Promise((resolve, reject) => {
    const worker = getWorker()

    // 生成唯一请求 ID 以匹配并发消息
    const requestId = Math.random().toString(36).slice(2)

    const handleMessage = (event: MessageEvent) => {
      const { type, value, blob, message, requestId: respId } = event.data

      if (respId !== requestId) return

      if (type === 'progress') {
        if (options.onProgress) options.onProgress(value)
      } else if (type === 'done') {
        clearTimeout(timeoutId)
        worker.removeEventListener('message', handleMessage)
        resolve(blob)
      } else if (type === 'error') {
        clearTimeout(timeoutId)
        worker.removeEventListener('message', handleMessage)
        reject(new Error(message || 'Worker 内部错误'))
      }
    }

    // 长任务兜底：单张超过 120s 判定失败，避免无限等待
    const timeoutId = setTimeout(() => {
      worker.removeEventListener('message', handleMessage)
      reject(new Error('处理超时（120 秒）'))
    }, 120_000)

    worker.addEventListener('message', handleMessage)

    const handleError = (error: ErrorEvent) => {
      console.error('[Imago Engine] Worker Error:', error)
      clearTimeout(timeoutId)
      worker.removeEventListener('message', handleMessage)
      sharedWorker = null // 标记损坏，下次重新创建
      reject(new Error(`Worker 计算失败: ${error.message}`))
    }
    worker.addEventListener('error', handleError, { once: true })

    // 监听中止信号
    if (options.signal) {
      options.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timeoutId)
          worker.removeEventListener('message', handleMessage)
          reject(new Error('AbortError'))
        },
        { once: true }
      )
    }

    // 发送任务到 Worker
    worker.postMessage({
      requestId,
      file,
      options: {
        model: options.model,
        usePreScaling: options.usePreScaling,
        maskThreshold: options.maskThreshold,
        maskBlur: options.maskBlur,
        maskShrink: options.maskShrink,
        jobId: options.jobId,
        format: options.format,
        quality: options.quality
      }
    })
  })
}
