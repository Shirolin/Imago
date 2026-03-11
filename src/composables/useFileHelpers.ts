import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import JSZip from 'jszip'

export function useFileHelpers() {
  const store = useImageStore()
  const fileInput = ref<HTMLInputElement | null>(null)
  const isDownloadingAll = ref(false)

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
   * 基于 MIME 类型获取新的文件名
   */
  const getNewFileName = (originalName: string, mimeType: string) => {
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/avif': '.avif',
      'image/heif': '.heif',
      'image/heic': '.heic',
      'image/jxl': '.jxl',
      'image/webp2': '.wp2',
      'image/jpeg-li': '.jpg',
      'image/gif': '.gif',
      'image/svg+xml': '.svg'
    }

    const newExt = mimeMap[mimeType]
    if (newExt) {
      const lastDot = originalName.lastIndexOf('.')
      if (lastDot !== -1) {
        return originalName.substring(0, lastDot) + newExt
      }
      return originalName + newExt
    }
    return originalName
  }

  /**
   * 下载已处理的文件
   */
  const downloadImage = (blob: Blob, originalFileName: string, prefix = 'processed_') => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    // 动态判断最终的扩展名
    const finalName = getNewFileName(originalFileName, blob.type)
    
    a.download = `${prefix}${finalName}`
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * 打包下载所有已处理图片为 ZIP
   */
  const downloadAllAsZip = async (prefix = 'Processed') => {
    const doneImages = store.images.filter((img) => img.status === 'done' && img.processedBlob)
    if (doneImages.length === 0) return

    isDownloadingAll.value = true
    try {
      const zip = new JSZip()

      doneImages.forEach((img) => {
        // 使用压缩后得到的真正 MIME 生成带正确扩展名的文件名
        const finalName = getNewFileName(img.file.name, img.processedBlob!.type)
        zip.file(`processed_${finalName}`, img.processedBlob!)
      })

      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)

      // 生成格式化时间戳: YYYYMMDD_HHMMSS
      const now = new Date()
      const timestamp =
        now
          .toISOString()
          .replace(/-/g, '')
          .replace(/:/g, '')
          .replace(/T/g, '')
          .split('.')[0]
          ?.slice(0, 14) || 'date'
      const fileName = `Imago_${prefix}_${timestamp}.zip`

      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to create ZIP:', error)
    } finally {
      isDownloadingAll.value = false
    }
  }

  return {
    fileInput,
    isDownloadingAll,
    formatSize,
    triggerFileInput,
    handleFileChange,
    downloadImage,
    downloadAllAsZip
  }
}
