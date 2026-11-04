/**
 * 模型输入是固定 1024×1024 的正方形，直接 resize 会把非方形图拉伸变形。
 * 这里统一做 letterbox：等比缩放到正方形内，留白区用边缘像素延展填充，
 * 推理后按同一个矩形把遮罩裁回原图比例。
 */

export interface LetterboxRect {
  x: number
  y: number
  width: number
  height: number
}

/** 计算原图在正方形模型输入中占据的矩形（居中对齐） */
export function computeLetterbox(width: number, height: number, size: number): LetterboxRect {
  const scale = size / Math.max(width, height)
  const contentWidth = Math.max(1, Math.min(size, Math.round(width * scale)))
  const contentHeight = Math.max(1, Math.min(size, Math.round(height * scale)))
  return {
    x: Math.floor((size - contentWidth) / 2),
    y: Math.floor((size - contentHeight) / 2),
    width: contentWidth,
    height: contentHeight
  }
}

/**
 * 从模型空间的遮罩里裁出原图内容区。
 * 遮罩尺寸不一定是 size（pipeline 可能返回别的分辨率），按比例换算。
 */
export function cropMaskAlpha(
  alpha: Uint8ClampedArray,
  maskWidth: number,
  maskHeight: number,
  content: LetterboxRect,
  size: number
): { alpha: Uint8ClampedArray; width: number; height: number } {
  if (maskWidth === 0 || maskHeight === 0) return { alpha, width: maskWidth, height: maskHeight }

  const scaleX = maskWidth / size
  const scaleY = maskHeight / size
  const x = Math.min(maskWidth - 1, Math.max(0, Math.round(content.x * scaleX)))
  const y = Math.min(maskHeight - 1, Math.max(0, Math.round(content.y * scaleY)))
  const width = Math.max(1, Math.min(maskWidth - x, Math.round(content.width * scaleX)))
  const height = Math.max(1, Math.min(maskHeight - y, Math.round(content.height * scaleY)))

  if (x === 0 && y === 0 && width === maskWidth && height === maskHeight) {
    return { alpha, width: maskWidth, height: maskHeight }
  }

  const cropped = new Uint8ClampedArray(width * height)
  for (let row = 0; row < height; row++) {
    const start = (y + row) * maskWidth + x
    cropped.set(alpha.subarray(start, start + width), row * width)
  }
  return { alpha: cropped, width, height }
}
