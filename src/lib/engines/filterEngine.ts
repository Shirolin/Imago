import type { ImageProcessor } from './types'

export interface FilterOptions {
  brightness: number
  contrast: number
  saturation: number
  blur: number
  grayscale: number
  sepia: number
  hueRotate: number
  invert: number
  vignette: number
  noise: number
  sharpen: number
  format?: string
  quality?: number
}

export const filterEngine: ImageProcessor<FilterOptions> = async (file, options) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // 1. 应用 CSS 滤镜 (基础调整)
      ctx.filter = `brightness(${options.brightness}%) contrast(${options.contrast}%) saturate(${options.saturation}%) blur(${options.blur}px) grayscale(${options.grayscale}%) sepia(${options.sepia}%) hue-rotate(${options.hueRotate}deg) invert(${options.invert}%)`
      ctx.drawImage(img, 0, 0)

      // 2. 锐化处理 (卷积矩阵)
      // 注意：必须在 drawImage 之后获取 ImageData，此时 filter 已经作用于像素
      if (options.sharpen > 0) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const sharpenedData = applySharpen(imageData, options.sharpen / 100)
        // 重置 filter 避免 putImageData 后的再次污染（虽然 putImageData 本身不受 filter 影响）
        ctx.filter = 'none'
        ctx.putImageData(sharpenedData, 0, 0)
      }

      // 3. 添加暗角 (Vignette)
      if (options.vignette > 0) {
        const gradient = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          0,
          canvas.width / 2,
          canvas.height / 2,
          Math.sqrt((canvas.width / 2) ** 2 + (canvas.height / 2) ** 2)
        )
        gradient.addColorStop(0, 'transparent')
        gradient.addColorStop(0.5, 'transparent')
        gradient.addColorStop(1, `rgba(0, 0, 0, ${options.vignette / 100})`)

        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      // 4. 添加噪点 (Noise)
      if (options.noise > 0) {
        const noiseData = ctx.createImageData(canvas.width, canvas.height)
        const data = noiseData.data
        const amount = options.noise / 100
        for (let i = 0; i < data.length; i += 4) {
          const val = (Math.random() - 0.5) * 255 * amount
          data[i] = val
          data[i + 1] = val
          data[i + 2] = val
          data[i + 3] = Math.random() * 255 * amount * 0.5 // 随机透明度
        }
        // 使用 lighter 模式叠加噪点
        ctx.save()
        ctx.globalCompositeOperation = 'screen'
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = canvas.width
        tempCanvas.height = canvas.height
        tempCanvas.getContext('2d')?.putImageData(noiseData, 0, 0)
        ctx.drawImage(tempCanvas, 0, 0)
        ctx.restore()
      }

      const outputFormat = (options.format === 'original' ? undefined : options.format) || file.type
      const outputQuality = options.quality ?? 0.95

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              size: blob.size,
              width: canvas.width,
              height: canvas.height,
              format: outputFormat
            })
          } else {
            reject(new Error('Canvas toBlob failed'))
          }
        },
        outputFormat,
        outputQuality
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

/**
 * 简单的锐化卷积
 * @param imageData 图像数据
 * @param amount 强度 (0-1)
 */
function applySharpen(imageData: ImageData, amount: number): ImageData {
  const w = imageData.width
  const h = imageData.height
  const data = imageData.data
  const output = new Uint8ClampedArray(data.length)

  // 锐化矩阵:
  //  0 -1  0
  // -1  5 -1
  //  0 -1  0
  // 混合原始与锐化
  const a = -amount
  const b = 1 + 4 * amount

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const i = idx + c
        // 简单 3x3 卷积
        const res =
          data[i]! * b + (data[i - 4]! + data[i + 4]! + data[i - w * 4]! + data[i + w * 4]!) * a
        output[i] = res
      }
      output[idx + 3] = data[idx + 3]! // Alpha
    }
  }

  return new ImageData(output, w, h)
}
