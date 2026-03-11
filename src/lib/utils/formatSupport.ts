/**
 * 检查浏览器是否支持特定 MIME 类型的图片编码/导出
 */
export async function isFormatSupported(mimeType: string): Promise<boolean> {
  // 1. 特殊处理 original 或不指定的情况
  if (!mimeType || mimeType === 'original') return true

  // 2. 特殊处理 jpeg-li (它最终是 image/jpeg)
  const targetMime = mimeType === 'image/jpeg-li' ? 'image/jpeg' : mimeType

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1

    // 尝试将 canvas 转换为目标格式的 Blob
    // 这是检测浏览器编码支持最可靠的方法
    const dataUrl = canvas.toDataURL(targetMime)
    return dataUrl.startsWith(`data:${targetMime}`)
  } catch {
    return false
  }
}

/**
 * 获取浏览器支持的状态映射
 */
export async function getSupportedFormats(formats: string[]): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {}
  for (const format of formats) {
    results[format] = await isFormatSupported(format)
  }
  return results
}
