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
}

export const useImageStore = defineStore('image', () => {
  const images = ref<ImageItem[]>([])
  const selectedIds = ref<Set<string>>(new Set())

  const hasSelected = computed(() => selectedIds.value.size > 0)
  const isAllSelected = computed(() => images.value.length > 0 && selectedIds.value.size === images.value.length)
  const selectedCount = computed(() => selectedIds.value.size)

  const addImages = (files: File[]) => {
    const newImages = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
      status: 'idle' as const,
      originalSize: file.size
    }))
    images.value.push(...newImages)
  }

  const removeImage = (id: string) => {
    const index = images.value.findIndex(img => img.id === id)
    if (index !== -1) {
      const img = images.value[index]
      if (img && img.preview) {
        URL.revokeObjectURL(img.preview)
      }
      images.value.splice(index, 1)
      selectedIds.value.delete(id)
    }
  }

  const removeSelected = () => {
    selectedIds.value.forEach(id => removeImage(id))
    selectedIds.value.clear()
  }

  const clearImages = () => {
    images.value.forEach(img => URL.revokeObjectURL(img.preview))
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
    images.value.forEach(img => selectedIds.value.add(img.id))
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
    const img = images.value.find(img => img.id === id)
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
