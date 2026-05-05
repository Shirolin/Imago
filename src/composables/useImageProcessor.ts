import { ref } from 'vue'
import { useImageStore, type ImageItem } from '../stores/imageStore'
import type { ImageProcessor, MultiImageProcessor, ProcessResult } from '../lib/engines/types'

export function useImageProcessor<T>(processor: ImageProcessor<T> | MultiImageProcessor<T>) {
  const store = useImageStore()
  const isProcessing = ref(false)
  const progress = ref(0)
  let currentController: AbortController | null = null

  const abortProcessing = () => {
    if (currentController) {
      currentController.abort()
      currentController = null
      isProcessing.value = false
      progress.value = 0
    }
  }

  const processSingle = async (
    id: string,
    options: T
  ): Promise<ProcessResult | Blob | Blob[] | undefined> => {
    const item = store.images.find((img) => img.id === id)
    if (!item) return

    const abortController = new AbortController()
    currentController = abortController
    store.updateImage(id, { status: 'processing', progress: 0, abortController })
    progress.value = 0

    try {
      const result = await (processor as ImageProcessor<T>)(item.file, {
        ...options,
        jobId: id,
        signal: abortController.signal,
        onProgress: (p: number) => {
          progress.value = p
          store.updateImage(id, { progress: p })
        }
      })

      store.updateImage(id, {
        status: 'done',
        progress: 1,
        abortController: undefined
      })
      currentController = null
      progress.value = 0
      return result
    } catch (error) {
      progress.value = 0
      currentController = null
      const err = error as Error
      if (
        err.name === 'AbortError' ||
        err.message?.includes('AbortError') ||
        err.message?.includes('abort')
      ) {
        store.updateImage(id, { status: 'idle', abortController: undefined })
        return
      }
      console.error('Processing failed for image:', id, error)
      store.updateImage(id, {
        status: 'error',
        error: err.message || '处理失败',
        abortController: undefined
      })
    }
  }

  const processCombine = async (options: T) => {
    isProcessing.value = true
    const files = store.images.map((img) => img.file)
    const abortController = new AbortController()
    currentController = abortController

    try {
      const result = await (processor as MultiImageProcessor<T>)(files, {
        ...options,
        signal: abortController.signal
      })
      isProcessing.value = false
      currentController = null
      return result
    } catch (error) {
      isProcessing.value = false
      currentController = null
      console.error('Combine failed:', error)
      throw error
    }
  }

  const processQueue = async (
    items: ImageItem[],
    options: T,
    onResult?: (id: string, result: ProcessResult | Blob | Blob[]) => void
  ) => {
    const total = items.length
    if (total === 0) return

    const CONCURRENCY_LIMIT = 3
    let index = 0
    const results: Promise<void>[] = []

    // 维护每张图的实时进度，用于计算精确的总进度
    const itemProgress = new Map<string, number>()

    const updateGlobalProgress = () => {
      const sum = Array.from(itemProgress.values()).reduce((a, b) => a + b, 0)
      progress.value = Math.min(100, Math.round((sum / total) * 100))
    }

    const worker = async () => {
      while (index < items.length) {
        const item = items[index++]
        if (item) {
          itemProgress.set(item.id, 0)
          const result = await processSingle(item.id, {
            ...options,
            onProgress: (p: number) => {
              itemProgress.set(item.id, p)
              updateGlobalProgress()
            }
          })
          if (result && onResult) {
            onResult(item.id, result as ProcessResult | Blob | Blob[])
          }
          itemProgress.set(item.id, 1) // 确保完成后计为 1
          updateGlobalProgress()
        }
      }
    }

    // 启动初始并发进程
    for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, items.length); i++) {
      results.push(worker())
    }

    await Promise.all(results)
  }

  const processAll = async (
    options: T,
    onResult?: (id: string, result: ProcessResult | Blob | Blob[]) => void
  ) => {
    isProcessing.value = true
    const pendingImages = store.images.filter((img) => img.status !== 'done')
    await processQueue(pendingImages, options, onResult)
    isProcessing.value = false
  }

  const processSelected = async (
    options: T,
    onResult?: (id: string, result: ProcessResult | Blob | Blob[]) => void
  ) => {
    isProcessing.value = true
    const selectedImages = store.images.filter((img) => store.selectedIds.has(img.id))
    await processQueue(selectedImages, options, onResult)
    isProcessing.value = false
  }

  return {
    isProcessing,
    progress,
    processSingle,
    processAll,
    processSelected,
    processCombine,
    abortProcessing
  }
}
