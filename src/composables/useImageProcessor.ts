import { getCurrentInstance, onUnmounted, ref } from 'vue'
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
      // 队列场景下由队列 controller 统一中止，这里兜底复位所有 processing 状态
      store.images.forEach((img) => {
        if (img.status === 'processing') {
          store.updateImage(img.id, { status: 'idle', abortController: undefined })
        }
      })
    }
  }

  /**
   * 处理单张图片。
   * - manageProcessing=false 时由调用方（processQueue）管理 isProcessing 与队列级 AbortController，
   *   用于修复批量处理时「取消只中止最后一个任务」与「进度聚合被覆盖」两个缺陷。
   * - 单独调用（如 SplitView 的 processSingle）时 manageProcessing 默认 true，
   *   修复此前 isProcessing 从不置位导致 CTA 无进度/可重复点击的问题。
   */
  const processSingle = async (
    id: string,
    options: T,
    externalOnProgress?: (p: number) => void,
    manageProcessing = true
  ): Promise<ProcessResult | Blob | Blob[] | undefined> => {
    const item = store.images.find((img) => img.id === id)
    if (!item) return

    const externalSignal = (options as { signal?: AbortSignal }).signal
    const ownController = externalSignal ? null : new AbortController()
    const signal = externalSignal ?? ownController!.signal
    if (ownController) currentController = ownController
    if (manageProcessing) isProcessing.value = true

    store.updateImage(id, {
      status: 'processing',
      progress: 0,
      abortController: ownController ?? undefined
    })

    try {
      const result = await (processor as ImageProcessor<T>)(item.file, {
        ...options,
        jobId: id,
        signal,
        onProgress: (p: number) => {
          if (signal.aborted) return
          // 单任务场景直接暴露进度；队列场景由 externalOnProgress 聚合后统一写入
          if (manageProcessing) progress.value = p
          store.updateImage(id, { progress: p })
          externalOnProgress?.(p)
        }
      })

      // 某些第三方处理器无法真正中断；abort 后即使 Promise 成功返回，
      // 也不能再把用户已取消的任务写回 done。
      if (signal.aborted) {
        store.updateImage(id, { status: 'idle', abortController: undefined })
        return
      }

      store.updateImage(id, {
        status: 'done',
        progress: 1,
        abortController: undefined
      })
      return result
    } catch (error) {
      const err = error as Error
      if (
        signal.aborted ||
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
    } finally {
      if (manageProcessing && (ownController === null || currentController === ownController)) {
        currentController = null
        isProcessing.value = false
        progress.value = 0
      }
    }
  }

  const processCombine = async (options: T) => {
    isProcessing.value = true
    const files = store.images.map((img) => img.file)
    const abortController = new AbortController()
    currentController = abortController

    try {
      return await (processor as MultiImageProcessor<T>)(files, {
        ...options,
        signal: abortController.signal
      })
    } catch (error) {
      console.error('Combine failed:', error)
      throw error
    } finally {
      if (currentController === abortController) {
        currentController = null
        isProcessing.value = false
      }
    }
  }

  const processQueue = async (
    items: ImageItem[],
    options: T,
    onResult?: (id: string, result: ProcessResult | Blob | Blob[]) => void
  ) => {
    const total = items.length
    if (total === 0) return

    // 队列级 AbortController：取消时中止整批任务，而非只杀最后一个
    const queueController = new AbortController()
    currentController = queueController
    isProcessing.value = true
    progress.value = 0

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
      while (!queueController.signal.aborted && index < items.length) {
        const item = items[index++]
        if (!item) continue
        itemProgress.set(item.id, 0)
        const result = await processSingle(
          item.id,
          { ...options, signal: queueController.signal },
          (p: number) => {
            itemProgress.set(item.id, p)
            updateGlobalProgress()
          },
          false
        )
        if (queueController.signal.aborted) return
        if (result && onResult) {
          onResult(item.id, result as ProcessResult | Blob | Blob[])
        }
        itemProgress.set(item.id, 1) // 确保完成后计为 1
        updateGlobalProgress()
      }
    }

    try {
      // 启动初始并发进程
      for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, items.length); i++) {
        results.push(worker())
      }

      await Promise.all(results)
    } finally {
      // 旧队列结束时不得覆盖同一 composable 中新启动的任务状态。
      if (currentController === queueController) {
        currentController = null
        isProcessing.value = false
        progress.value = 0
      }
    }
  }

  const processAll = async (
    options: T,
    onResult?: (id: string, result: ProcessResult | Blob | Blob[]) => void
  ) => {
    const pendingImages = store.images.filter((img) => img.status !== 'done')
    await processQueue(pendingImages, options, onResult)
  }

  const processSelected = async (
    options: T,
    onResult?: (id: string, result: ProcessResult | Blob | Blob[]) => void
  ) => {
    const selectedImages = store.images.filter((img) => store.selectedIds.has(img.id))
    await processQueue(selectedImages, options, onResult)
  }

  // composable 只在组件 setup 中使用时自动随宿主卸载；独立测试或非组件调用不注册。
  if (getCurrentInstance()) {
    onUnmounted(abortProcessing)
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
