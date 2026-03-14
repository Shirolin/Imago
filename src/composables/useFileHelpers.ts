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
   * 下载已处理的文件 (支持单张图或多张切片)
   */
  const downloadImage = async (
    blob: Blob | Blob[],
    originalFileName: string,
    tag = '_Imago_Processed'
  ) => {
    // 如果是多张子图（如切图结果），打一个小 ZIP 下载
    if (Array.isArray(blob)) {
      const zip = new JSZip()
      blob.forEach((b, idx) => {
        const lastDot = originalFileName.lastIndexOf('.')
        const baseName = lastDot !== -1 ? originalFileName.substring(0, lastDot) : originalFileName
        const finalName = getNewFileName(`${baseName}_tile_${idx + 1}`, b.type, tag)
        zip.file(finalName, b)
      })
      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      const lastDot = originalFileName.lastIndexOf('.')
      const zipName = `${lastDot !== -1 ? originalFileName.substring(0, lastDot) : originalFileName}${tag}.zip`
      a.download = zipName
      a.click()
      URL.revokeObjectURL(url)
      return
    }

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
   * 逻辑：遍历所有图片，如果图片产生多个切片，则在 ZIP 内创建文件夹存储
   */
  const downloadAllAsZip = async (tag = '_Imago_Processed') => {
    const doneImages = store.images.filter(
      (img) => img.status === 'done' && (img.processedBlob || img.processedBlobs)
    )
    if (doneImages.length === 0) return

    isDownloadingAll.value = true
    try {
      const zip = new JSZip()

      doneImages.forEach((img) => {
        const lastDot = img.file.name.lastIndexOf('.')
        const baseName = lastDot !== -1 ? img.file.name.substring(0, lastDot) : img.file.name

        if (img.processedBlobs && img.processedBlobs.length > 0) {
          // 场景 A: 该图片产生了多个结果（如切图）
          // 为避免混乱，在压缩包内为该图片建立子文件夹
          const folder = zip.folder(baseName)
          img.processedBlobs.forEach((b, idx) => {
            const finalName = getNewFileName(`${baseName}_tile_${idx + 1}`, b.type, tag)
            folder?.file(finalName, b)
          })
        } else if (img.processedBlob) {
          // 场景 B: 常见的单图处理（压缩、Resize）
          const finalName = getNewFileName(img.file.name, img.processedBlob.type, tag)
          zip.file(finalName, img.processedBlob)
        }
      })

      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)

      const now = new Date()
      const timestamp =
        now
          .toISOString()
          .replace(/-/g, '')
          .replace(/:/g, '')
          .replace(/T/g, '')
          .split('.')[0]
          ?.slice(0, 14) || 'date'
      const fileName = `Imago_All_${timestamp}.zip`

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
