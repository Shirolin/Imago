import { removeBackground } from '@imgly/background-removal'
import type { ImageProcessor } from './types'

export interface BgRemoveOptions {
  format?: string
  quality?: number
}

/**
 * 使用 @imgly/background-removal 在纯本地执行背景移除操作
 */
export const bgRemoveEngine: ImageProcessor<BgRemoveOptions> = async (file, options) => {
  console.log('[Imago Engine] 🪄 Starting Local Background Removal', options)

  try {
    // 强制输出格式为 PNG，因为背景移除后的图片需要支持 Alpha 透明通道
    // 该库默认返回 image/png 格式的 Blob，完全在本地或 WebWorker 执行
    // 维护一个阶段性的最大进度，确保进度条只增不减
    let maxProgress = 0

    const imageBlob = await removeBackground(file, {
      progress: (key: string, current: number, total: number) => {
        const p = current / total
        let weightedP = 0

        // 阶段权重分配：加载模型(0.3) -> 实际推理(0.7)
        if (key.includes('fetch')) {
          weightedP = p * 0.3
        } else if (key.includes('compute')) {
          weightedP = 0.3 + p * 0.7
        } else {
          weightedP = p
        }

        // 确保进度不回退
        maxProgress = Math.max(maxProgress, weightedP)
        if (options.onProgress) options.onProgress(maxProgress)

        console.log(`[BgRemove Progress] ${key}: ${Math.round(maxProgress * 100)}%`)
      },
      // @ts-expect-error - 兼容性处理，某些版本可能在 options 中缺少 signal 定义
      signal: options.signal
    })
    if (!imageBlob) {
      throw new Error('背景移除引擎未返回任何有效数据')
    }

    return imageBlob
  } catch (error) {
    const err = error as Error
    // 如果是用户主动取消，则向上抛出特定错误
    if (err.name === 'AbortError') {
      console.log('[Imago Engine] Background Removal Cancelled by user')
      throw error
    }

    console.error('[Imago Engine] Background Removal Failed:', error)
    // 包装错误信息，使其更具可读性
    throw new Error(`背景去除失败: ${err.message || '未知错误'}`)
  }
}
