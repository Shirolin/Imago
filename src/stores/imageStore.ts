import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ImageItem {
  id: string
  file: File
  preview: string
  status: 'idle' | 'processing' | 'done' | 'error'
  originalSize: number
  processedSize?: number
  processedBlob?: Blob
  error?: string
  abortController?: AbortController
}

export const useImageStore = defineStore('image', () => {
  const images = ref<ImageItem[]>([])
  const selectedIds = ref<Set<string>>(new Set())

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
    // If nothing is processing and everything is done, it's 100%
    if (processingCount.value === 0 && doneCount.value === totalCount.value) return 100
    // Otherwise calculate based on done items
    return Math.round((doneCount.value / totalCount.value) * 100)
  })

  const addImages = (files: File[]) => {
    // Generate an unique key for existing files to prevent duplicates
    const existingKeys = new Set(
      images.value.map((img) => `${img.file.name}-${img.file.size}-${img.file.lastModified}`)
    )

    // Filter out duplicates
    const uniqueFiles = files.filter((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`
      if (existingKeys.has(key)) return false
      existingKeys.add(key)
      return true
    })

    const newImages = uniqueFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
      status: 'idle' as const,
      originalSize: file.size
    }))
    images.value.push(...newImages)
  }

  const removeImage = (id: string) => {
    const index = images.value.findIndex((img) => img.id === id)
    if (index !== -1) {
      const img = images.value[index]
      if (img && img.abortController) {
        img.abortController.abort() // Immediately stop background processing
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
    updateImage
  }
})
