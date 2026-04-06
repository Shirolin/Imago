import { removeBackground } from '@imgly/background-removal'
import type { ImageProcessor } from './types'

export interface BgRemoveOptions {
  format?: string
  quality?: number
}

/**
 * 使用 @imgly/background-removal 在纯本地执行抠图操作
 */
export const bgRemoveEngine: ImageProcessor<BgRemoveOptions> = async (file, options) => {
  console.log('[Imago Engine] 🪄 Starting Local Background Removal', options)

  try {
    // 强制输出格式为 PNG，因为去背后的图片需要支持 Alpha 透明通道
    // 该库默认返回 image/png 格式的 Blob，完全在本地或 WebWorker 执行
    const imageBlob = await removeBackground(file, {
      // 这里的 progress 回调会在模型下载和推理阶段触发
      progress: (key: string, current: number, total: number) => {
        // 转换进度为 0-1 之间的数字
        const p = current / total
        if (options.onProgress) options.onProgress(p)
        console.log(`[BgRemove Progress] ${key}: ${current}/${total} (${Math.round(p * 100)}%)`)
      },
      // 显式传递中止信号，允许用户取消耗时的抠图任务
      // 注意：部分旧版库可能不支持 signal 参数，需确保依赖版本匹配
      // 如果报错，可能需要封装在 try-catch 中或检查库文档
      // @ts-expect-error - 兼容性处理，如果库版本较旧可能没有 signal 定义
      signal: options.signal
    })

    if (!imageBlob) {
      throw new Error('抠图引擎未返回任何有效数据')
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
