const ALPHA_MAX = 255

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/**
 * 精修 AI 遮罩的 alpha（0-255）：
 * - strictness（0-1）：围绕 0.5 提高对比度，边缘判定更果断，但不移动轮廓；
 * - offset（0-1）：把 [offset, 1] 重映射到 [0, 1]，软遮罩的 0.5 等值线向内收缩，
 *   完全不透明的内部保持不变（近似腐蚀）。
 *
 * 只在 alpha 空间计算。canvas 的 brightness/contrast filter 不作用于 alpha，
 * 这是此前「判定强度 / 边缘收缩」两个滑杆对结果毫无影响的根因。
 */
export const refineMaskAlpha = (alpha: number, strictness: number, offset: number): number => {
  const normalized = alpha / ALPHA_MAX
  // 收缩：重映射 [offset, 1] -> [0, 1]。完全不透明的内部保持 255，只把软边向内压。
  const shrink = clamp01(offset)
  const shrunk = shrink >= 1 ? 0 : clamp01((normalized - shrink) / (1 - shrink))
  // 判定强度：围绕 0.5 拉大对比度，边缘更果断且不移动轮廓
  const contrast = 1 + clamp01(strictness) * 4
  return Math.round(clamp01(0.5 + (shrunk - 0.5) * contrast) * ALPHA_MAX)
}
