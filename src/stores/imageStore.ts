import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ImageItem {
  id: string
  file: File
  preview: string
  status: 'idle' | 'processing' | 'done' | 'error'
  originalSize: number
  width?: number
  height?: number
  format: string
  processedSize?: number
  processedBlob?: Blob
  processedWidth?: number
  processedHeight?: number
  error?: string
  abortController?: AbortController
  isDirty?: boolean
}

export const useImageStore = defineStore('image', () => {
  const images = ref<ImageItem[]>([])
  const selectedIds = ref<Set<string>>(new Set())

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
    return Math.round((doneCount.value / totalCount.value) * 100)
  })

  // 脏数据管理
  const markAllAsDirty = () => {
    images.value.forEach((img) => {
      if (img.status === 'done') {
        img.isDirty = true
      }
    })
  }

  const resetImage = (id: string) => {
    const img = images.value.find((i) => i.id === id)
    if (img) {
      if (img.abortController) {
        img.abortController.abort()
      }
      img.status = 'idle'
      img.processedBlob = undefined
      img.processedSize = undefined
      img.error = undefined
      img.isDirty = false
    }
  }

  const resetAll = () => {
    images.value.forEach((img) => {
      resetImage(img.id)
    })
  }

  const addImages = async (files: File[]) => {
    const existingKeys = new Set(
      images.value.map((img) => `${img.file.name}-${img.file.size}-${img.file.lastModified}`)
    )

    const uniqueFiles = files.filter((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`
      if (existingKeys.has(key)) return false
      existingKeys.add(key)
      return true
    })

    const newImagePromises = uniqueFiles.map(async (file) => {
      const preview = URL.createObjectURL(file)

      // 获取分辨率
      const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image()
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight })
          URL.revokeObjectURL(img.src)
        }
        img.onerror = () => resolve({ width: 0, height: 0 })
        img.src = URL.createObjectURL(file)
      })

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

    const resolvedImages = await Promise.all(newImagePromises)
    images.value.push(...resolvedImages)
  }

  const removeImage = (id: string) => {
    const index = images.value.findIndex((img) => img.id === id)
    if (index !== -1) {
      const img = images.value[index]
      if (img && img.abortController) {
        img.abortController.abort()
      }
      if (img && img.preview) {
        URL.revokeObjectURL(img.preview)
      }
      images.value.splice(index, 1)
      selectedIds.value.delete(id)
    }
  }

  const removeSelected = () => {
    selectedIds.value.forEach((id) => removeImage(id))
    selectedIds.value.clear()
  }

  const clearImages = () => {
    images.value.forEach((img) => {
      if (img.abortController) img.abortController.abort()
      if (img.preview) URL.revokeObjectURL(img.preview)
    })
    images.value = []
    selectedIds.value.clear()
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

  return {
    images,
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
    selectAll,
    deselectAll,
    toggleAll,
    updateImage,
    showMagnifier,
    setShowMagnifier,
    markAllAsDirty,
    resetImage,
    resetAll
  }
})
