import type { ProcessResult } from '../engines/types'

/**
 * 引擎返回值的归一化。
 *
 * 引擎层的返回形状目前有三种，且都不是 ProcessResult 说谎造成的偶然：
 *  - `{ blob, size, ... }`      绝大多数引擎
 *  - `{ blobs, size }`          splitEngine
 *  - 裸 `Blob`                  bgRemoveEngine / matchBgRemoveEngine（签名声明
 *                              Promise<ProcessResult>，实际 resolve(blob)）
 * 用 ImageItem 或视图去兜这三种，等于让 N 个调用方各写一遍防御；
 * 在 seam 内归一一次，接口上只留 Blob[] 一种形态。
 */

export interface NormalizedResult {
  /** 恒为长度 >= 1 的数组。单图结果长度 1，切图结果长度 N */
  outputs: Blob[]
  /** 引擎给出的字节数，缺失时回退首个产出的体积 */
  size: number
  width?: number
  height?: number
  skipped?: boolean
}

/**
 * 把引擎的任意返回值收敛为 NormalizedResult。
 * 空产出（引擎返回空 / 无 Blob）返回 null——调用方据此不写结果，
 * 避免出现「status=done 但结果集为空」的幽灵条目。
 */
export function normalizeEngineOutput(raw: unknown): NormalizedResult | null {
  // 裸 Blob：bgRemoveEngine / matchBgRemoveEngine
  if (raw instanceof Blob) {
    return { outputs: [raw], size: raw.size }
  }

  // 裸 Blob[]：兼容任何直接返回数组的引擎
  if (Array.isArray(raw)) {
    const blobs = raw.filter((b): b is Blob => b instanceof Blob)
    return blobs.length > 0 ? { outputs: blobs, size: blobs[0]!.size } : null
  }

  if (raw === null || typeof raw !== 'object') return null

  const r = raw as ProcessResult
  if (r.blobs && r.blobs.length > 0) {
    return {
      outputs: r.blobs,
      size: r.size || r.blobs[0]!.size,
      width: r.width,
      height: r.height,
      skipped: r.skipped
    }
  }
  if (r.blob) {
    return {
      outputs: [r.blob],
      size: r.size || r.blob.size,
      width: r.width,
      height: r.height,
      skipped: r.skipped
    }
  }
  return null
}

/**
 * 把引擎上报的进度归一到 0..1。
 *
 * useImageProcessor 的两条路径量纲不同：processSingle 写引擎原始值（0-1），
 * processQueue 写聚合百分比（0-100）。调用方过去靠 `p <= 1 ? p * 100 : p` 之类的
 * 启发式区分，遇到引擎上报 100% 的单图任务会被读成 100 倍。
 */
export function normalizeProgress(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0
  if (raw <= 1) return Math.min(1, raw)
  return Math.min(1, raw / 100)
}
