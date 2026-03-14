import type { MultiImageProcessor } from './types'

export interface CombineOptions {
  direction: 'vertical' | 'horizontal' | 'grid'
  spacing: number
  backgroundColor: string
  alignment: 'start' | 'center' | 'end'
}

export const combineEngine: MultiImageProcessor<CombineOptions> = async (files, options) => {
  if (files.length === 0) throw new Error('No files to combine')

  const images = await Promise.all(
    files.map((file) => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`))
        img.src = URL.createObjectURL(file)
      })
    })
  )

  let totalWidth = 0
  let totalHeight = 0

  const maxWidth = Math.max(...images.map((img) => img.width))
  const maxHeight = Math.max(...images.map((img) => img.height))

  if (options.direction === 'vertical') {
    totalWidth = maxWidth
    totalHeight =
      images.reduce((sum, img) => sum + img.height, 0) + (images.length - 1) * options.spacing
  } else if (options.direction === 'horizontal') {
    totalWidth =
      images.reduce((sum, img) => sum + img.width, 0) + (images.length - 1) * options.spacing
    totalHeight = maxHeight
  } else {
    const cols = Math.ceil(Math.sqrt(images.length))
    const rows = Math.ceil(images.length / cols)
    totalWidth = maxWidth * cols + (cols - 1) * options.spacing
    totalHeight = maxHeight * rows + (rows - 1) * options.spacing
  }

  const canvas = document.createElement('canvas')
  canvas.width = totalWidth
  canvas.height = totalHeight
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) throw new Error('Failed to get canvas context')

  // Clear/Fill background
  if (options.backgroundColor === 'transparent') {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  } else {
    ctx.fillStyle = options.backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  let currentX = 0
  let currentY = 0

  if (options.direction === 'vertical') {
    images.forEach((img) => {
      let x = 0
      if (options.alignment === 'center') x = (totalWidth - img.width) / 2
      else if (options.alignment === 'end') x = totalWidth - img.width

      ctx.drawImage(img, x, currentY)
      currentY += img.height + options.spacing
    })
  } else if (options.direction === 'horizontal') {
    images.forEach((img) => {
      let y = 0
      if (options.alignment === 'center') y = (totalHeight - img.height) / 2
      else if (options.alignment === 'end') y = totalHeight - img.height

      ctx.drawImage(img, currentX, y)
      currentX += img.width + options.spacing
    })
  } else {
    const cols = Math.ceil(Math.sqrt(images.length))
    images.forEach((img, i) => {
      const r = Math.floor(i / cols)
      const c = i % cols

      let offsetX = 0
      let offsetY = 0

      if (options.alignment === 'center') {
        offsetX = (maxWidth - img.width) / 2
        offsetY = (maxHeight - img.height) / 2
      } else if (options.alignment === 'end') {
        offsetX = maxWidth - img.width
        offsetY = maxHeight - img.height
      }

      const x = c * (maxWidth + options.spacing) + offsetX
      const y = r * (maxHeight + options.spacing) + offsetY
      ctx.drawImage(img, x, y)
    })
  }

  // Cleanup object URLs
  images.forEach((img) => URL.revokeObjectURL(img.src))

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve({
          blob,
          size: blob.size,
          width: canvas.width,
          height: canvas.height,
          format: 'png'
        })
      } else {
        reject(new Error('Canvas toBlob failed'))
      }
    }, 'image/png')
  })
}
