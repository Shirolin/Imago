import type { ImageProcessor } from './types'
import { injectMetadata } from '../utils/metadata'

export interface CropOptions {
  x?: number
  y?: number
  width?: number
  height?: number
  usePercentage?: boolean // 是否使用百分比坐标 (0-100)
  rotation?: number // 0, 90, 180, 270
  flipH?: boolean
  flipV?: boolean
  quality?: number
  format?: string
  preserveExif?: boolean
}

export const cropEngine: ImageProcessor<CropOptions> = async (file, options) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(url)

      // 创建一个临时画布用于处理旋转和翻转
      const workCanvas = document.createElement('canvas')
      const workCtx = workCanvas.getContext('2d', { alpha: true })
      if (!workCtx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      const rotation = (options.rotation || 0) % 360
      const isVertical = rotation === 90 || rotation === 270

      // 旋转后的原始图像尺寸
      const rotatedWidth = isVertical ? img.height : img.width
      const rotatedHeight = isVertical ? img.width : img.height

      workCanvas.width = rotatedWidth
      workCanvas.height = rotatedHeight

      // 应用变换并绘制原始图像到工作画布
      workCtx.translate(rotatedWidth / 2, rotatedHeight / 2)
      workCtx.rotate((rotation * Math.PI) / 180)
      workCtx.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1)
      workCtx.drawImage(img, -img.width / 2, -img.height / 2)

      // 计算裁剪坐标
      let cropX = options.x ?? 0
      let cropY = options.y ?? 0
      let cropW = options.width ?? rotatedWidth
      let cropH = options.height ?? rotatedHeight

      // 如果使用百分比，则转换为像素
      if (options.usePercentage) {
        cropX = (cropX / 100) * rotatedWidth
        cropY = (cropY / 100) * rotatedHeight
        cropW = (cropW / 100) * rotatedWidth
        cropH = (cropH / 100) * rotatedHeight
      }

      // 确保裁剪区域不超出旋转后的边界
      cropX = Math.max(0, Math.min(cropX, rotatedWidth))
      cropY = Math.max(0, Math.min(cropY, rotatedHeight))
      cropW = Math.max(1, Math.min(cropW, rotatedWidth - cropX))
      cropH = Math.max(1, Math.min(cropH, rotatedHeight - cropY))

      // 现在在已变换的图像上进行裁剪
      const finalCanvas = document.createElement('canvas')
      const finalCtx = finalCanvas.getContext('2d', { alpha: true, desynchronized: true })
      if (!finalCtx) {
        reject(new Error('Failed to get final canvas context'))
        return
      }

      finalCanvas.width = Math.round(cropW)
      finalCanvas.height = Math.round(cropH)

      // 从工作画布中截取目标区域
      finalCtx.imageSmoothingEnabled = true
      finalCtx.imageSmoothingQuality = 'high'
      finalCtx.drawImage(
        workCanvas,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        finalCanvas.width,
        finalCanvas.height
      )

      const targetFormat = options.format || file.type
      const targetQuality = options.quality ?? 0.9

      finalCanvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'))
            return
          }

          let finalBlob = blob

          // 元数据保留逻辑 (仅针对 JPEG)
          if (options.preserveExif && file.type === 'image/jpeg' && targetFormat === 'image/jpeg') {
            try {
              const processedBuffer = await blob.arrayBuffer()
              const mergedBuffer = await injectMetadata(file, processedBuffer, 'image/jpeg')
              finalBlob = new Blob([mergedBuffer], { type: 'image/jpeg' })
            } catch (e) {
              console.warn('Metadata injection failed during crop:', e)
            }
          }

          resolve({
            blob: finalBlob,
            size: finalBlob.size,
            width: finalCanvas.width,
            height: finalCanvas.height
          })
        },
        targetFormat,
        targetQuality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        img.src = ''
        reject(new Error('Task aborted'))
      })
    }

    img.src = url
  })
}
