export type InteractionType = 'list' | 'canvas' | 'special'

export interface ViewMeta {
  id: string
  label: string
  interactionType: InteractionType
  features: {
    showLayoutToggle: boolean
    showImageStatus: boolean
    allowBatchProcess: boolean
  }
}

export const VIEW_CONFIGS: Record<string, ViewMeta> = {
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

  favicon: {
    id: 'favicon',
    label: '站标生成',
    interactionType: 'special',
    features: { showLayoutToggle: false, showImageStatus: true, allowBatchProcess: false }
  }
}

export const getViewConfig = (viewId: string): ViewMeta | undefined => {
  if (VIEW_CONFIGS[viewId]) return VIEW_CONFIGS[viewId]
  return Object.values(VIEW_CONFIGS).find((view) => view.id === viewId)
}
