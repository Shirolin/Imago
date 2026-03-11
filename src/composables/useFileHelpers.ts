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
   * 基于 MIME 类型获取新的文件名，并可选注入后缀
   */
  const getNewFileName = (originalName: string, mimeType: string, tag = '') => {
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/avif': '.avif',
      'image/jxl': '.jxl',
      'image/webp2': '.wp2',
      'image/jpeg-li': '.jpg'
    }

    const newExt = mimeMap[mimeType] || '.jpg'
    const lastDot = originalName.lastIndexOf('.')
    const baseName = lastDot !== -1 ? originalName.substring(0, lastDot) : originalName

    // 如果 baseName 已经包含了该 tag，则不再重复添加
    const finalTag = baseName.includes(tag) ? '' : tag
    return `${baseName}${finalTag}${newExt}`
  }

  /**
   * 下载已处理的文件
   */
  const downloadImage = (blob: Blob, originalFileName: string, tag = '_Imago_Processed') => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url

    const finalName = getNewFileName(originalFileName, blob.type, tag)
    a.download = finalName
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * 打包下载所有已处理图片为 ZIP
   */
  const downloadAllAsZip = async (tag = '_Imago_Processed') => {
    const doneImages = store.images.filter((img) => img.status === 'done' && img.processedBlob)
    if (doneImages.length === 0) return

    isDownloadingAll.value = true
    try {
      const zip = new JSZip()

      doneImages.forEach((img) => {
        const finalName = getNewFileName(img.file.name, img.processedBlob!.type, tag)
        zip.file(finalName, img.processedBlob!)
      })

      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)

      const now = new Date()
      // 避免使用容易被 esbuild 误认为 CSS 语法的正则 [ - : T ]
      const timestamp =
        now
          .toISOString()
          .replace(/-/g, '')
          .replace(/:/g, '')
          .replace(/T/g, '')
          .split('.')[0]
          ?.slice(0, 14) || 'date'
      // 压缩包本身保留 Imago 前缀，方便识别来源
      const fileName = `Imago_Archive_${timestamp}.zip`

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
