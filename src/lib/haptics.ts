/**
 * 触感反馈辅助函数（navigator.vibrate 包装）。
 * 交互即时反馈（选中线、吸附、排序、删除等）共用一个强度约定：
 * 5 = 轻微 / 8-15 = 明确动作。环境无 vibration API 时静默跳过。
 */
export const triggerHaptic = (intensity = 5): void => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(intensity)
  }
}
