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

      // 起点用 ceil 确保不包含起点前的背景像素；
      // 终点用 floor(起点+宽度) 确保不超出内容边界（Math.round 在缩放图像时可能多包含 1 行白色背景）
      const finalX = Math.ceil(cropX)
      const finalY = Math.ceil(cropY)
      const finalW = Math.max(1, Math.floor(cropX + cropW) - finalX)
      const finalH = Math.max(1, Math.floor(cropY + cropH) - finalY)

      // 应用边框修剪（用户手动指定的像素内缩）
      const trim = options.trimPx ?? {}
      const tT = Math.max(0, trim.top ?? 0)
      const tB = Math.max(0, trim.bottom ?? 0)
      const tL = Math.max(0, trim.left ?? 0)
      const tR = Math.max(0, trim.right ?? 0)

      // 确保裁剪区域不超出旋转后的边界，同时应用修剪
      const safeX = Math.max(0, Math.min(finalX + tL, rotatedWidth - 1))
      const safeY = Math.max(0, Math.min(finalY + tT, rotatedHeight - 1))
      const safeW = Math.max(1, Math.min(finalW - tL - tR, rotatedWidth - safeX))
      const safeH = Math.max(1, Math.min(finalH - tT - tB, rotatedHeight - safeY))

      // 现在在已变换的图像上进行裁剪
      const finalCanvas = document.createElement('canvas')
      const finalCtx = finalCanvas.getContext('2d', { alpha: true, desynchronized: true })
      if (!finalCtx) {
        reject(new Error('Failed to get final canvas context'))
        return
      }

      finalCanvas.width = safeW
      finalCanvas.height = safeH

      // 从工作画布中截取目标区域
      finalCtx.imageSmoothingEnabled = true
      finalCtx.imageSmoothingQuality = 'high'
      finalCtx.drawImage(
        workCanvas,
        safeX,
        safeY,
        safeW,
        safeH,
        0,
        0,
        finalCanvas.width,
        finalCanvas.height
      )

      // 边缘像素清理：四边各 3 行/列，alpha < 128 设为全透明
      // 与 CropBox isBg 阈值保持一致，消灭导出时半透明边缘在白底上显现的白边
      try {
        const edgeData = finalCtx.getImageData(0, 0, safeW, safeH)
        const d = edgeData.data
        const scanDepth = 3
        for (let pass = 0; pass < scanDepth; pass++) {
          for (const row of [pass, safeH - 1 - pass]) {
            for (let x = 0; x < safeW; x++) {
              const i = (row * safeW + x) * 4
              if ((d[i + 3] ?? 0) < 128) d[i + 3] = 0
            }
          }
          for (const col of [pass, safeW - 1 - pass]) {
            for (let y = 0; y < safeH; y++) {
              const i = (y * safeW + col) * 4
              if ((d[i + 3] ?? 0) < 128) d[i + 3] = 0
            }
          }
        }
        finalCtx.putImageData(edgeData, 0, 0)
      } catch {
        // 跨域或安全限制下跳过清理
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
