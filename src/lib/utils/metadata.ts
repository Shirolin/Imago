/**
 * 极简元数据缝合工具
 * 核心原理：将原始图片的元数据数据块 (如 JPEG 的 APP1) 提取并插入到处理后的二进制流中
 */

/**
 * 将原始文件的 EXIF 等元数据注入到处理后的 ArrayBuffer 中
 * 目前支持：JPEG (APP1 标记)
 */
export async function injectMetadata(
  originalFile: File,
  processedBuffer: ArrayBuffer,
  mimeType: string
): Promise<ArrayBuffer> {
  if (!mimeType.includes('jpeg') && !mimeType.includes('jpg')) {
    // 目前仅对 JPEG 进行成熟的缝合，WebP/AVIF 结构较复杂暂不处理或使用库处理
    return processedBuffer
  }

  const originalBuffer = await originalFile.arrayBuffer()
  const originalView = new DataView(originalBuffer)
  const processedView = new DataView(processedBuffer)

  // 1. 从原图中寻找 EXIF (APP1 标记: 0xFFE1)
  let exifBlock: ArrayBuffer | null = null
  for (let i = 0; i < originalView.byteLength - 4; i++) {
    if (originalView.getUint8(i) === 0xff && originalView.getUint8(i + 1) === 0xe1) {
      const length = originalView.getUint16(i + 2)
      exifBlock = originalBuffer.slice(i, i + 2 + length)
      break
    }
  }

  if (!exifBlock) return processedBuffer

  // 2. 将 EXIF 块插入到处理后图片的首个标记 (SOI: 0xFFD8) 之后
  if (processedView.getUint8(0) === 0xff && processedView.getUint8(1) === 0xd8) {
    const newBuffer = new Uint8Array(processedBuffer.byteLength + exifBlock.byteLength)
    const exifArray = new Uint8Array(exifBlock)
    const processedArray = new Uint8Array(processedBuffer)

    newBuffer.set(processedArray.slice(0, 2), 0) // SOI
    newBuffer.set(exifArray, 2) // EXIF Block
    newBuffer.set(processedArray.slice(2), 2 + exifBlock.byteLength) // Remaining Image Data

    return newBuffer.buffer
  }

  return processedBuffer
}
