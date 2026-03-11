import { ref } from 'vue'
import { useImageStore, type ImageItem } from '../stores/imageStore'
import type { ImageProcessor, MultiImageProcessor } from '../lib/engines/types'

export function useImageProcessor<T>(processor: ImageProcessor<T> | MultiImageProcessor<T>) {
  const store = useImageStore()
  const isProcessing = ref(false)

  const processSingle = async (id: string, options: T) => {
    const item = store.images.find((img) => img.id === id)
    if (!item) return

    const abortController = new AbortController()
    store.updateImage(id, { status: 'processing', abortController })

    try {
      const result = await (processor as ImageProcessor<T>)(item.file, {
        ...options,
        signal: abortController.signal
      })

      store.updateImage(id, {
        status: 'done',
        processedSize: result.size,
        processedBlob: result.blob || (result.blobs ? result.blobs[0] : undefined),
        abortController: undefined,
        isDirty: false
      })
      return result
    } catch (error) {
      const err = error as Error
      if (err.name === 'AbortError' || err.message?.includes('abort')) {
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

    try {
      const result = await (processor as MultiImageProcessor<T>)(files, {
        ...options,
        signal: abortController.signal
      })
      isProcessing.value = false
      return result
    } catch (error) {
      isProcessing.value = false
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
    processSingle,
    processAll,
    processSelected,
    processCombine
  }
}
