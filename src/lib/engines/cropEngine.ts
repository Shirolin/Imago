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
  // 导出边框修剪（像素），独立于裁剪框预览，用于精确去除白边
  trimPx?: { top?: number; bottom?: number; left?: number; right?: number }
  fillColor?: string // 扩图时的填充色
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

      // 起点用 ceil，终点用 floor 确保边缘抗锯齿像素向内紧致收缩
      let finalX = Math.ceil(cropX)
      let finalY = Math.ceil(cropY)
      let finalW = Math.max(1, Math.floor(cropX + cropW) - finalX)
      let finalH = Math.max(1, Math.floor(cropY + cropH) - finalY)

      // 应用边框修剪（用户手动指定的像素内缩）
      const trim = options.trimPx ?? {}
      const tT = Math.max(0, trim.top ?? 0)
      const tB = Math.max(0, trim.bottom ?? 0)
      const tL = Math.max(0, trim.left ?? 0)
      const tR = Math.max(0, trim.right ?? 0)

      finalX += tL
      finalY += tT
      finalW = Math.max(1, finalW - tL - tR)
      finalH = Math.max(1, finalH - tT - tB)

      // 创建最终画布
      const finalCanvas = document.createElement('canvas')
      const finalCtx = finalCanvas.getContext('2d', { alpha: true, desynchronized: true })
      if (!finalCtx) {
        reject(new Error('Failed to get final canvas context'))
        return
      }

      finalCanvas.width = finalW
      finalCanvas.height = finalH

      // 如果设定了填充色且不是透明，则填充底层（用于扩图）
      if (options.fillColor && options.fillColor !== 'transparent') {
        finalCtx.fillStyle = options.fillColor
        finalCtx.fillRect(0, 0, finalW, finalH)
      }

      // 将工作画布绘制到最终画布上，通过负向偏移量实现裁剪和扩图的自动适应
      finalCtx.imageSmoothingEnabled = true
      finalCtx.imageSmoothingQuality = 'high'
      finalCtx.drawImage(workCanvas, -finalX, -finalY)

      // 检测是否发生了外扩
      const isExpanding =
        finalX < 0 ||
        finalY < 0 ||
        finalX + finalW > rotatedWidth ||
        finalY + finalH > rotatedHeight

      // 仅在严格裁剪（未扩图）时，清理可能因为抗锯齿残留的细微背景像素
      if (!isExpanding) {
        try {
          const edgeData = finalCtx.getImageData(0, 0, finalW, finalH)
          const d = edgeData.data
          const scanDepth = 3
          for (let pass = 0; pass < scanDepth; pass++) {
            for (const row of [pass, finalH - 1 - pass]) {
              for (let x = 0; x < finalW; x++) {
                const i = (row * finalW + x) * 4
                if ((d[i + 3] ?? 0) < 128) d[i + 3] = 0
              }
            }
            for (const col of [pass, finalW - 1 - pass]) {
              for (let y = 0; y < finalH; y++) {
                const i = (y * finalW + col) * 4
                if ((d[i + 3] ?? 0) < 128) d[i + 3] = 0
              }
            }
          }
          finalCtx.putImageData(edgeData, 0, 0)
        } catch {
          // 跨域或安全限制下跳过清理
        }
      }

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
