/**
 * 视图级 UI 开关。
 *
 * 此前这里是一份 82 行的全局配置表（10 个视图 × 9 个字段），实际只有
 * `features.showLayoutToggle` 一个字段被 ImageActionsToolbar 读取，其余字段
 * 没有消费者——全局表让label 只能是硬编码中文（丢掉 i18n），也让人误以为
 * 改这里能调整各视图行为。收缩为真正被读的那一项。
 */
export interface ViewFeatureFlags {
  /** 卡片尺寸切换按钮是否可见。无卡片网格的视图（如 Combine）传 false */
  showLayoutToggle: boolean
}

const FLAGS: Record<string, ViewFeatureFlags> = {
  // list 型：卡片网格，保留尺寸切换
  compress: { showLayoutToggle: true },
  resize: { showLayoutToggle: true },
  exif: { showLayoutToggle: true },
  'bg-remove': { showLayoutToggle: true },
  filters: { showLayoutToggle: true },
  // canvas 型：无卡片网格，隐藏
  crop: { showLayoutToggle: false },
  split: { showLayoutToggle: false },
  combine: { showLayoutToggle: false },
  moldCut: { showLayoutToggle: false },
  // 特殊形态：走自己的矩阵布局
  favicon: { showLayoutToggle: false }
}

export function getViewConfig(viewId: string): ViewFeatureFlags | undefined {
  return FLAGS[viewId]
}
