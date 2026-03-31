import type { ImageProcessor, ProcessResult, SplitOptions } from './types'

/**
 * 智能切图引擎 (Web Canvas 版)
 */
export const splitEngine: ImageProcessor<SplitOptions> = async (file, options) => {
  return new Promise<ProcessResult>((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(url)
      const results: Blob[] = []
      const {
        rows,
        cols,
        mode,
        customLines,
        centerMode = 'none',
        shave = 0,
        format = file.type,
        quality = 0.9,
        onProgress
      } = options

      // 计算切分边界
      let boundariesX: number[] = []
      let boundariesY: number[] = []

      if (mode === 'custom' && customLines) {
        boundariesX = [0, ...customLines.x.sort((a, b) => a - b), img.width]
        boundariesY = [0, ...customLines.y.sort((a, b) => a - b), img.height]
      } else {
        const tileW = img.width / cols
        const tileH = img.height / rows
        for (let i = 0; i <= cols; i++) boundariesX.push(i * tileW)
        for (let i = 0; i <= rows; i++) boundariesY.push(i * tileH)
      }

      const actualRows = boundariesY.length - 1
      const actualCols = boundariesX.length - 1
      let processedCount = 0

      for (let r = 0; r < actualRows; r++) {
        for (let c = 0; c < actualCols; c++) {
          // 【核心加固】：检查中止信号
          if (options.signal?.aborted) {
            throw new Error('AbortError')
          }

          processedCount++
          if (processedCount % 10 === 0) {
            await new Promise((res) => setTimeout(res, 0))
          }

          // 上报进度 (0 to 1)
          onProgress?.(processedCount / (actualRows * actualCols))

          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) continue

          const startX = boundariesX[c]!
          const startY = boundariesY[r]!
          const endX = boundariesX[c + 1]!
          const endY = boundariesY[r + 1]!

          const sourceX = startX + shave
          const sourceY = startY + shave
          const sourceW = endX - startX - shave * 2
          const sourceH = endY - startY - shave * 2

          if (sourceW <= 0 || sourceH <= 0) continue

          if (centerMode !== 'none') {
            const tempCanvas = document.createElement('canvas')
            tempCanvas.width = sourceW
            tempCanvas.height = sourceH
            const tempCtx = tempCanvas.getContext('2d')
            if (tempCtx) {
              tempCtx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH)
              const bgPixel = tempCtx.getImageData(0, 0, 1, 1).data
              const bounds = getContentBounds(tempCtx, bgPixel)

              if (bounds && bgPixel) {
                let finalW = sourceW
                let finalH = sourceH
                if (centerMode === 'square') {
                  finalW = finalH = Math.max(sourceW, sourceH)
                }
                canvas.width = finalW
                canvas.height = finalH
                ctx.fillStyle = `rgba(${bgPixel[0]}, ${bgPixel[1]}, ${bgPixel[2]}, ${bgPixel[3]! / 255})`
                ctx.fillRect(0, 0, finalW, finalH)
                const destX = (finalW - bounds.width) / 2
                const destY = (finalH - bounds.height) / 2
                ctx.drawImage(
                  tempCanvas,
                  bounds.x,
                  bounds.y,
                  bounds.width,
                  bounds.height,
                  destX,
                  destY,
                  bounds.width,
                  bounds.height
                )
              } else {
                canvas.width = sourceW
                canvas.height = sourceH
                ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH)
              }
            }
          } else {
            canvas.width = sourceW
            canvas.height = sourceH
            ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH)
          }

          const blob = await new Promise<Blob | null>((res) => {
            try {
              canvas.toBlob((b) => res(b), format, quality)
            } catch {
              res(null)
            }
          })

          if (blob) results.push(blob)
          // 清理 Canvas 尺寸以释放显存
          canvas.width = canvas.height = 0
        }
      }
      resolve({
        blobs: results,
        size: results.reduce((acc, b) => acc + b.size, 0)
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

function getContentBounds(ctx: CanvasRenderingContext2D, bgPixel: Uint8ClampedArray) {
  const { width, height } = ctx.canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0
  const threshold = 30

  // 【优化】：分级扫描策略
  // 第一步：粗略扫描 (步长为 4)，确定初步边界
  const step = width * height > 1000000 ? 4 : 1 // 超过 100万像素时启用跳行扫描

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      const rDiff = Math.abs((data[i] ?? 0) - (bgPixel[0] ?? 0))
      const gDiff = Math.abs((data[i + 1] ?? 0) - (bgPixel[1] ?? 0))
      const bDiff = Math.abs((data[i + 2] ?? 0) - (bgPixel[2] ?? 0))
      if (rDiff > threshold || gDiff > threshold || bDiff > threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  // 第二步：如果初步边界有效，在其周边进行精细微调 (仅当 step > 1 时)
  if (step > 1 && maxX >= minX) {
    minX = Math.max(0, minX - step)
    minY = Math.max(0, minY - step)
    maxX = Math.min(width - 1, maxX + step)
    maxY = Math.min(height - 1, maxY + step)
  }

  if (maxX < minX || maxY < minY) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}
