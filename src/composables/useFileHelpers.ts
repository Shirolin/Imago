import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'

export function useFileHelpers() {
  const store = useImageStore()
  const fileInput = ref<HTMLInputElement | null>(null)

  /**
   * 格式化文件大小 (B, KB, MB, GB)
   */
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 触发隐藏的文件选择框
   */
  const triggerFileInput = () => {
    fileInput.value?.click()
  }

  /**
   * 处理文件选择变更并添加到 Store
   */
  const handleFileChange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (files) {
      store.addImages(Array.from(files))
    }
  }

  /**
   * 下载已处理的文件
   */
  const downloadImage = (blob: Blob, fileName: string, prefix = 'processed_') => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${prefix}${fileName}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    fileInput,
    formatSize,
    triggerFileInput,
    handleFileChange,
    downloadImage
  }
}
