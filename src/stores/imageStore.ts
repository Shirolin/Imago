import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { MAX_FILE_BYTES, exceedsImportDimensions } from '../lib/limits'

export interface ImageItem {
  id: string
  file: File
  preview: string
  status: 'idle' | 'processing' | 'done' | 'error'
  progress?: number // 0 to 1
  originalSize: number
  width?: number
  height?: number
  format: string
  error?: string
  abortController?: AbortController
  exifCount?: number
  isExifUnsupported?: boolean
  exifError?: string
}

export type ImageRejectReason = 'type' | 'size' | 'dimensions' | 'decode'

export interface RejectedImage {
  file: File
  reason: ImageRejectReason
  width?: number
  height?: number
}

export const useImageStore = defineStore('image', () => {
  const images = ref<ImageItem[]>([])
  const selectedIds = ref<Set<string>>(new Set())
  const activeId = ref<string | null>(null)
  const sortMode = ref<'upload' | 'name' | 'status'>('upload')

  // 智能倍镜设置
  const showMagnifier = ref(localStorage.getItem('imago-show-magnifier') !== 'false')

  const setShowMagnifier = (value: boolean) => {
    showMagnifier.value = value
    localStorage.setItem('imago-show-magnifier', String(value))
  }

  const hasSelected = computed(() => selectedIds.value.size > 0)
  const isAllSelected = computed(
    () => images.value.length > 0 && selectedIds.value.size === images.value.length
  )
  const selectedCount = computed(() => selectedIds.value.size)

  const processingCount = computed(
    () => images.value.filter((img) => img.status === 'processing').length
  )
  const doneCount = computed(() => images.value.filter((img) => img.status === 'done').length)
  const totalCount = computed(() => images.value.length)

  const globalProgress = computed(() => {
    if (totalCount.value === 0) return 0
    if (processingCount.value === 0 && doneCount.value === totalCount.value) return 100

    // 计算已完成的部分 + 正在处理的部分的权重
    const doneBase = doneCount.value
    const processingProgress = images.value
      .filter((img) => img.status === 'processing')
      .reduce((sum, img) => sum + (img.progress || 0), 0)

    return Math.round(((doneBase + processingProgress) / totalCount.value) * 100)
  })

  // 排序逻辑
  const sortedImages = computed(() => {
    const list = [...images.value]
    if (sortMode.value === 'upload') return list
    if (sortMode.value === 'name')
      return list.sort((a, b) => a.file.name.localeCompare(b.file.name))
    if (sortMode.value === 'status') {
      const order = { processing: 0, error: 1, idle: 2, done: 3 }
      return list.sort((a, b) => order[a.status] - order[b.status])
    }
    return list
  })

  // 获取当前的活动图片对象 (回退逻辑：如果 activeId 无效，取最后一张)
  const activeImage = computed(() => {
    if (!images.value.length) return null
    return (
      images.value.find((img) => img.id === activeId.value) ||
      images.value[images.value.length - 1] ||
      null
    )
  })

  const VALID_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif',
    'image/svg+xml',
    'image/heic',
    'image/heif'
  ]

  const addImages = async (files: File[]): Promise<RejectedImage[]> => {
    const rejected: RejectedImage[] = []

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith('image/') && !VALID_IMAGE_TYPES.includes(file.type)) {
        rejected.push({ file, reason: 'type' })
        return false
      }
      if (file.size > MAX_FILE_BYTES) {
        rejected.push({ file, reason: 'size' })
        return false
      }
      return true
    })

    if (validFiles.length === 0) return rejected

    const existingKeys = new Set(
      images.value.map((img) => `${img.file.name}-${img.file.size}-${img.file.lastModified}`)
    )

    const uniqueFiles = validFiles.filter((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`
      if (existingKeys.has(key)) return false
      existingKeys.add(key)
      return true
    })

    const newImagePromises = uniqueFiles.map(async (file) => {
      const preview = URL.createObjectURL(file)

      const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image()
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight })
        }
        img.onerror = () => resolve({ width: 0, height: 0 })
        img.src = preview
      })

      if (dimensions.width <= 0 || dimensions.height <= 0) {
        URL.revokeObjectURL(preview)
        rejected.push({ file, reason: 'decode' })
        return null
      }

      if (exceedsImportDimensions(dimensions.width, dimensions.height)) {
        URL.revokeObjectURL(preview)
        rejected.push({
          file,
          reason: 'dimensions',
          width: dimensions.width,
          height: dimensions.height
        })
        return null
      }

      return {
        id: Math.random().toString(36).substring(7),
        file,
        preview,
        status: 'idle' as const,
        originalSize: file.size,
        width: dimensions.width,
        height: dimensions.height,
        format: file.name.split('.').pop()?.toUpperCase() || 'IMG'
      }
    })

    const resolvedImages = (await Promise.all(newImagePromises)).filter(
      (img): img is NonNullable<typeof img> => img !== null
    )
    images.value.push(...resolvedImages)

    // 自动激活最后一张新图片
    if (resolvedImages.length > 0) {
      const last = resolvedImages[resolvedImages.length - 1]
      if (last) activeId.value = last.id
    }

    return rejected
  }

  const removeImage = (id: string) => {
    const index = images.value.findIndex((img) => img.id === id)
    if (index !== -1) {
      const img = images.value[index]
      if (img) {
        if (img.abortController) img.abortController.abort()
        if (img.preview) URL.revokeObjectURL(img.preview)
      }

      images.value.splice(index, 1)
      selectedIds.value.delete(id)

      // 如果删除的是活动图片，切换到现有列表的最后一张
      if (activeId.value === id) {
        const last = images.value[images.value.length - 1]
        activeId.value = last ? last.id : null
      }
    }
  }

  const removeSelected = () => {
    const idsToRemove = Array.from(selectedIds.value)
    idsToRemove.forEach((id) => removeImage(id))
    selectedIds.value.clear()
  }

  const clearImages = () => {
    images.value.forEach((img) => {
      if (img.abortController) img.abortController.abort()
      if (img.preview) {
        try {
          URL.revokeObjectURL(img.preview)
        } catch (e) {
          console.error('Failed to revoke URL:', e)
        }
      }
    })
    images.value = []
    selectedIds.value.clear()
    activeId.value = null
  }

  const toggleSelection = (id: string) => {
    if (selectedIds.value.has(id)) {
      selectedIds.value.delete(id)
    } else {
      selectedIds.value.add(id)
    }
  }

  const selectAll = () => {
    images.value.forEach((img) => selectedIds.value.add(img.id))
  }

  const deselectAll = () => {
    selectedIds.value.clear()
  }

  const toggleAll = () => {
    if (isAllSelected.value) {
      deselectAll()
    } else {
      selectAll()
    }
  }

  const updateImage = (id: string, updates: Partial<ImageItem>) => {
    const img = images.value.find((img) => img.id === id)
    if (img) {
      Object.assign(img, updates)
    }
  }

  const reorderImage = (fromId: string, toId: string) => {
    const fromIndex = images.value.findIndex((img) => img.id === fromId)
    const toIndex = images.value.findIndex((img) => img.id === toId)

    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      const [movedItem] = images.value.splice(fromIndex, 1)
      images.value.splice(toIndex, 0, movedItem!)
    }
  }

  const selectRange = (id: string) => {
    if (!activeId.value) {
      toggleSelection(id)
      return
    }

    const list = sortedImages.value
    const startIdx = list.findIndex((img) => img.id === activeId.value)
    const endIdx = list.findIndex((img) => img.id === id)

    if (startIdx === -1 || endIdx === -1) return

    const min = Math.min(startIdx, endIdx)
    const max = Math.max(startIdx, endIdx)

    for (let i = min; i <= max; i++) {
      const item = list[i]
      if (item) selectedIds.value.add(item.id)
    }
  }

  return {
    images,
    activeId,
    activeImage,
    sortedImages,
    sortMode,
    selectedIds,
    hasSelected,
    isAllSelected,
    selectedCount,
    processingCount,
    doneCount,
    totalCount,
    globalProgress,
    addImages,
    removeImage,
    removeSelected,
    clearImages,
    toggleSelection,
    selectRange,
    selectAll,
    deselectAll,
    toggleAll,
    updateImage,
    reorderImage,
    showMagnifier,
    setShowMagnifier
  }
})
