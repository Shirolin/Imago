import type { ImageProcessor } from './types'
import BgRemoveWorker from './bgRemove.worker?worker'
import { AbortError } from './abort'

export interface BgRemoveOptions {
  format?: string
  quality?: number
  usePreScaling?: boolean
  model?: 'smart' | 'pro' // 模型档位：ORMBG 量化 / BiRefNet-lite
  maskThreshold?: number // 边缘严格度 (0-1)
  maskBlur?: number // 平滑度
  maskShrink?: number // 边缘偏移 (0-1)
  jobId?: string // 用于缓存 AI 遮罩以实现秒级精修
}

let sharedWorker: Worker | null = null

interface ActiveRequest {
  worker: Worker
  fail: (error: Error) => void
}

const activeRequests = new Set<ActiveRequest>()

export const disposeBgRemoveWorker = (message = '背景移除 Worker 已释放') => {
  const worker = sharedWorker
  sharedWorker = null
  worker?.terminate()

  // terminate 不会向 Promise 派发消息，必须主动结束该 Worker 上的全部请求。
  for (const request of activeRequests) {
    if (request.worker === worker) {
      request.fail(new Error(message))
    }
  }
}

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
    const requestId = Math.random().toString(36).slice(2)
    let settled = false
    const timeoutRef: { current?: ReturnType<typeof setTimeout> } = {}

    const cleanup = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
      options.signal?.removeEventListener('abort', handleAbort)
      activeRequests.delete(request)
    }

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const request: ActiveRequest = { worker, fail }

    const succeed = (blob: Blob) => {
      if (settled) return
      settled = true
      cleanup()
      // 包成 ProcessResult：此前直接 resolve(blob)，与声明的 Promise<ProcessResult>
      // 不符，迫使每个调用方写 `result.blob || (result as Blob)` 双保险
      resolve({ blob, size: blob.size })
    }

    const handleMessage = (event: MessageEvent) => {
      const { type, value, blob, message, requestId: respId } = event.data
      if (respId !== requestId || settled) return

      if (type === 'progress') {
        if (options.onProgress) options.onProgress(value)
      } else if (type === 'done') {
        succeed(blob)
      } else if (type === 'error') {
        fail(new Error(message || 'Worker 内部错误'))
      }
    }

    const handleError = (event: ErrorEvent) => {
      console.error('[Imago Engine] Worker Error:', event)
      const error = new Error(`Worker 计算失败: ${event.message}`)
      // 旧 Worker 的迟到 error 事件不能终止已经替换的新 Worker。
      if (sharedWorker === worker) {
        disposeBgRemoveWorker(error.message)
      } else {
        fail(error)
      }
    }

    const handleAbort = () => {
      // 第三方推理无法协作取消；终止共享 Worker 才能真正停止 CPU/GPU 工作。
      if (sharedWorker === worker) {
        disposeBgRemoveWorker('AbortError')
      } else {
        fail(new AbortError())
      }
    }

    activeRequests.add(request)
    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleError, { once: true })
    options.signal?.addEventListener('abort', handleAbort, { once: true })

    if (options.signal?.aborted) {
      handleAbort()
      return
    }

    timeoutRef.current = setTimeout(() => {
      if (sharedWorker === worker) {
        disposeBgRemoveWorker('处理超时（180 秒）')
      } else {
        fail(new Error('处理超时（180 秒）'))
      }
    }, 180_000)

    try {
      worker.postMessage({
        requestId,
        type: 'infer',
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
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

export interface PreloadBgModelOptions {
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

/**
 * 在共享 Worker 内预下载/初始化模型。模型缓存在 Worker 内存里，
 * 后续推理不会重复加载；失败时由调用方决定是否重试。
 */
export const preloadBgRemoveModel = (
  model: 'smart' | 'pro',
  options: PreloadBgModelOptions = {}
) => {
  return new Promise<void>((resolve, reject) => {
    const worker = getWorker()
    const requestId = Math.random().toString(36).slice(2)
    let settled = false

    const cleanup = () => {
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
      options.signal?.removeEventListener('abort', handleAbort)
      activeRequests.delete(request)
    }

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const request: ActiveRequest = { worker, fail }

    const handleMessage = (event: MessageEvent) => {
      const { type, value, message, requestId: respId } = event.data
      if (respId !== requestId || settled) return

      if (type === 'preload-progress') {
        options.onProgress?.(value)
      } else if (type === 'preload-done') {
        settled = true
        cleanup()
        resolve()
      } else if (type === 'error') {
        fail(new Error(message || '模型加载失败'))
      }
    }

    const handleError = (event: ErrorEvent) => {
      console.error('[Imago Engine] Worker Error:', event)
      const error = new Error(`模型加载失败: ${event.message}`)
      if (sharedWorker === worker) {
        disposeBgRemoveWorker(error.message)
      } else {
        fail(error)
      }
    }

    const handleAbort = () => {
      if (sharedWorker === worker) {
        disposeBgRemoveWorker('AbortError')
      } else {
        fail(new AbortError())
      }
    }

    activeRequests.add(request)
    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleError, { once: true })
    options.signal?.addEventListener('abort', handleAbort, { once: true })

    if (options.signal?.aborted) {
      handleAbort()
      return
    }

    try {
      worker.postMessage({ requestId, type: 'preload', model })
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)))
    }
  })
}
