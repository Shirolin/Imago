/**
 * i18n keys used only as AppSegmentedControl labels.
 * Keep copy short (single line); section headers carry full meaning.
 */
export const SEGMENT_LABEL_KEYS = [
  'common.export.qualityMode',
  'common.export.targetSizeMode',
  'tools.bgRemove.engineMatch',
  'tools.bgRemove.enginePro',
  'tools.bgRemove.engineSmart',
  'tools.resize.byPercentage',
  'tools.resize.byDimensions',
  'tools.combine.dirVertical',
  'tools.combine.dirHorizontal',
  'tools.combine.grid',
  'tools.combine.smartScale',
  'tools.combine.originalSize',
  'tools.combine.alignLeft',
  'tools.combine.alignRight',
  'tools.combine.alignCenter',
  'tools.combine.alignTop',
  'tools.combine.alignBottom',
  'tools.combine.start',
  'tools.combine.center',
  'tools.combine.end',
  'tools.crop.freeRatio',
  'tools.crop.noGrid',
  'tools.crop.thirds',
  'tools.crop.golden',
  'tools.split.uniformGrid',
  'tools.split.freeEdit',
  'tools.split.standard',
  'tools.split.center',
  'tools.split.square'
] as const

/** Worst-case column counts for segmented controls (@11px). */
export const SEGMENT_BUDGET = {
  /** Crop aspect ratio row (5 options). */
  cols5: { cjk: 3, latin: 8 },
  cols3: { cjk: 5, latin: 14 },
  cols2: { cjk: 8, latin: 18 }
} as const

/** Keys tested against the tightest (5-column) budget. */
export const SEGMENT_COLS5_KEYS = new Set<string>(['tools.crop.freeRatio'])

export const CJK_LOCALES = new Set(['ja', 'ko', 'zh-CN', 'zh-TW'])

/** Disabled footer CTAs with a left icon (~200px text area, up to 2 lines). */
export const FOOTER_SELECT_KEYS = [
  'tools.bgRemove.cta.select',
  'tools.split.cta.select',
  'tools.filters.cta.select',
  'tools.resize.cta.select',
  'tools.crop.cta.select',
  'tools.exif.cta.select',
  'tools.compress.cta.selectImage',
  'tools.combine.cta.select'
] as const

export const FOOTER_SELECT_BUDGET = { cjk: 10, latin: 22 } as const

/** Half-width fill buttons (e.g. crop undo/redo in 2-col grid with icon). */
export const GRID_HALF_FILL_KEYS = [
  'tools.crop.undo',
  'tools.crop.redo',
  'tools.split.verticalLine',
  'tools.split.horizontalLine',
  'tools.split.syncGrid',
  'tools.split.clearAll'
] as const

export const GRID_HALF_FILL_BUDGET = { cjk: 6, latin: 10 } as const

/** BgRemove model status panel labels (~200px inspector, single line). */
export const MODEL_STATUS_LABEL_KEYS = [
  'tools.bgRemove.engineDashboard',
  'tools.bgRemove.currentModel',
  'tools.bgRemove.connectionStatus',
  'tools.bgRemove.statusReady',
  'tools.bgRemove.statusUpdate'
] as const

export const MODEL_STATUS_LABEL_BUDGET = { cjk: 6, latin: 12 } as const

/** BgRemove refiner section header + core tier badge (single line in ~200px). */
export const REFINER_HEADER_KEYS = [
  'tools.bgRemove.refinerTitle',
  'tools.bgRemove.corePremium',
  'tools.bgRemove.coreLite'
] as const

export const REFINER_HEADER_BUDGET = { cjk: 6, latin: 12 } as const

/** Filters preset chip labels (~80px wide, up to 2 lines @11px). */
export const FILTER_PRESET_KEYS = [
  'tools.filters.presets.none',
  'tools.filters.presets.clarendon',
  'tools.filters.presets.lofi',
  'tools.filters.presets.valencia',
  'tools.filters.presets.gingham',
  'tools.filters.presets.f1977',
  'tools.filters.presets.aden',
  'tools.filters.presets.reyes',
  'tools.filters.presets.inkwell',
  'tools.filters.presets.lark'
] as const

export const FILTER_PRESET_BUDGET = { cjk: 6, latin: 10 } as const
