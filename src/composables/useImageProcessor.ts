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

  const processSingle = async (id: string, options: T) => {
    const item = store.images.find((img) => img.id === id)
    if (!item) return

    const abortController = new AbortController()
    currentController = abortController
    store.updateImage(id, { status: 'processing', abortController })
    progress.value = 0

    try {
      const result = await (processor as ImageProcessor<T>)(item.file, {
        ...options,
        signal: abortController.signal,
        onProgress: (p: number) => {
          progress.value = p
          store.updateImage(id, { progress: p })
        }
      })

      // 智能识别返回结果：可能是单个 Blob，也可能是 Blob[]，或者是包含这些属性的对象
      const typedResult = result as ProcessResult
      const isArray = Array.isArray(result)
      const blobs = isArray ? (result as unknown as Blob[]) : typedResult.blobs
      const singleBlob = !isArray ? typedResult.blob || (result as unknown as Blob) : undefined
      const finalBlob = singleBlob instanceof Blob ? singleBlob : blobs ? blobs[0] : undefined

      // 如果已有处理后的预览，先释放旧的
      if (item.processedPreview) {
        URL.revokeObjectURL(item.processedPreview)
      }

      // 生成新的预览 URL
      const processedPreview = finalBlob ? URL.createObjectURL(finalBlob) : undefined

      store.updateImage(id, {
        status: 'done',
        processedSize: isArray
          ? (result as unknown as Blob[]).reduce((sum, b) => sum + b.size, 0)
          : typedResult.size,
        processedBlob: finalBlob,
        processedPreview,
        processedBlobs: blobs,
        processedWidth: typedResult.width,
        processedHeight: typedResult.height,
        abortController: undefined,
        isDirty: false
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

  const processQueue = async (items: ImageItem[], options: T) => {
    const CONCURRENCY_LIMIT = 3
    let index = 0
    const results: Promise<void>[] = []

    const worker = async () => {
      while (index < items.length) {
        const item = items[index++]
        if (item) {
          await processSingle(item.id, options)
        }
      }
    }

    // 启动初始并发进程
    for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, items.length); i++) {
      results.push(worker())
    }

    await Promise.all(results)
  }

  const processAll = async (options: T) => {
    isProcessing.value = true
    const pendingImages = store.images.filter((img) => img.status !== 'done' || img.isDirty)
    await processQueue(pendingImages, options)
    isProcessing.value = false
  }

  const processSelected = async (options: T) => {
    isProcessing.value = true
    const selectedImages = store.images.filter((img) => store.selectedIds.has(img.id))
    await processQueue(selectedImages, options)
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
