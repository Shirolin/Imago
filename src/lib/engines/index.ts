import type { ImageProcessor } from './types'
import { compressEngine, type CompressionOptions } from './compressEngine'
import { wasmEngine } from './wasmEngine'
import { isFormatSupported } from '../utils/formatSupport'

/**
 * Imago 核心图片处理引擎路由 (智能分发层)
 * 结合原生 Canvas 的极速性能与 WebAssembly 的全格式碾压能力
 */
export const dualEngine: ImageProcessor<CompressionOptions> = async (file, options) => {
  const targetFormat = options.format || file.type

  // Canvas 原生引擎的强项：快，内存小。这些格式首选原生。
  // 注意：jpeg-li 比较特殊，强制走 Wasm 以获得最佳的 mozjpeg/jpeg-li 优化级别
  const nativePreferredFormats = ['image/jpeg', 'image/png', 'image/webp']

  if (nativePreferredFormats.includes(targetFormat)) {
    const skipNativeForPngColors =
      targetFormat === 'image/png' && options.colors != null && options.colors < 256
    const isNativeSupported = await isFormatSupported(targetFormat)
    if (isNativeSupported && !skipNativeForPngColors) {
      try {
        console.log(`[Imago Engine] 🚀 Routing to Native Canvas Engine for ${targetFormat}`)
        return await compressEngine(file, options)
      } catch (error) {
        console.warn(
          `[Imago Engine] ⚠️ Native Canvas Engine failed for ${targetFormat}, falling back to WebAssembly Engine. Reason:`,
          error
        )
        // 如果原生引擎失败（例如 browser-image-compression 拒绝转换格式），
        // 则继续向下执行，尝试使用强大的 Wasm 引擎
      }
    }
  }

  // 如果浏览器原生不支持（如大部分浏览器的 AVIF，所有的 JXL 等）
  // 或者是次世代的高级格式（如 JPEG-LI），统统路由给重型武器 Wasm
  console.log(`[Imago Engine] ⚙️ Routing to WebAssembly Engine for ${targetFormat}`)
  return wasmEngine(file, options)
}

// 同时导出以供其他模块可能得单独调用
export { compressEngine, wasmEngine }
