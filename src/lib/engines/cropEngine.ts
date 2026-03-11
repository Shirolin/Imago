import type { ImageProcessor } from './types'

export interface CropOptions {
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number // 0, 90, 180, 270
  flipH?: boolean
  flipV?: boolean
}

export const cropEngine: ImageProcessor<CropOptions> = async (file, options) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // 计算旋转后的尺寸
      const rotation = (options.rotation || 0) % 360
      const isVertical = rotation === 90 || rotation === 270
      const drawWidth = isVertical ? img.height : img.width
      const drawHeight = isVertical ? img.width : img.height

      // 默认全图裁剪（如果未提供参数）
      const cropW = options.width ?? drawWidth
      const cropH = options.height ?? drawHeight

      canvas.width = cropW
      canvas.height = cropH

      // 设置变换
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1)

      // 注意：绘制位置需要考虑裁剪偏移和原始居中
      // 由于我们简化了，目前先支持旋转和翻转
      ctx.drawImage(img, -img.width / 2, -img.height / 2)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              size: blob.size,
              width: canvas.width,
              height: canvas.height
            })
          } else {
            reject(new Error('Canvas toBlob failed'))
          }
        },
        file.type,
        0.95
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
