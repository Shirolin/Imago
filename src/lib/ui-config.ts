/**
 * Imago UI 核心配置文件
 * 统一管理各功能模块的交互类型与界面特性
 */

export type InteractionType = 'list' | 'canvas' | 'special'

export interface ViewMeta {
  id: string
  label: string
  interactionType: InteractionType
  features: {
    showLayoutToggle: boolean // 是否显示卡片尺寸切换按钮
    showImageStatus: boolean // 是否显示图片选择状态
    allowBatchProcess: boolean // 是否允许批量处理
  }
}

export const VIEW_CONFIGS: Record<string, ViewMeta> = {
  // 列表式交互 (List-based)
  compress: {
    id: 'compress',
    label: '压缩转换',
    interactionType: 'list',
    features: { showLayoutToggle: true, showImageStatus: true, allowBatchProcess: true }
  },
  resize: {
    id: 'resize',
    label: '调整尺寸',
    interactionType: 'list',
    features: { showLayoutToggle: true, showImageStatus: true, allowBatchProcess: true }
  },
  exif: {
    id: 'exif',
    label: '清除EXIF',
    interactionType: 'list',
    features: { showLayoutToggle: true, showImageStatus: true, allowBatchProcess: true }
  },
  bgRemove: {
    id: 'bg-remove',
    label: '去除背景',
    interactionType: 'list',
    features: { showLayoutToggle: true, showImageStatus: true, allowBatchProcess: true }
  },
  filters: {
    id: 'filters',
    label: '色彩滤镜',
    interactionType: 'list',
    features: { showLayoutToggle: true, showImageStatus: true, allowBatchProcess: true }
  },

  // 画布式交互 (Canvas-based)
  crop: {
    id: 'crop',
    label: '裁剪图片',
    interactionType: 'canvas',
    features: { showLayoutToggle: false, showImageStatus: true, allowBatchProcess: false }
  },
  split: {
    id: 'split',
    label: '图片分割',
    interactionType: 'canvas',
    features: { showLayoutToggle: false, showImageStatus: true, allowBatchProcess: false }
  },
  combine: {
    id: 'combine',
    label: '长图拼接',
    interactionType: 'canvas',
    features: { showLayoutToggle: false, showImageStatus: true, allowBatchProcess: false }
  },

  // 特殊交互 (Special)
  favicon: {
    id: 'favicon',
    label: '站标生成',
    interactionType: 'special',
    features: { showLayoutToggle: false, showImageStatus: true, allowBatchProcess: false }
  }
}

/**
 * 获取指定视图的配置
 */
export const getViewConfig = (viewId: string): ViewMeta | undefined => {
  return VIEW_CONFIGS[viewId]
}
