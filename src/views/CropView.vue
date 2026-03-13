<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useImageStore } from '../stores/imageStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppSelect from '../components/common/AppSelect.vue'
import AppInput from '../components/common/AppInput.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import CropBox from '../components/common/CropBox.vue'
import {
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  X,
  Square,
  CheckSquare,
  ListOrdered,
  Scissors,
  FileType,
  Maximize2,
  Undo2,
  Redo2,
  Pipette,
  RefreshCcw,
  Info
} from 'lucide-vue-next'
import { cropEngine } from '../lib/engines/cropEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

const store = useImageStore()

// --- 状态 (Refs) ---
const selectedImageId = ref<string | null>(store.images[0]?.id || null)
const rotation = ref(0)
const flipH = ref(false)
const flipV = ref(false)
const currentRatio = ref<number | undefined>(undefined) // undefined for free
const outputQuality = ref(0.92)
const outputFormat = ref<string>('original')
const preserveExif = ref(false)

// 当前裁剪坐标 (从 CropBox 组件传回)
const internalCrop = ref({ x: 10, y: 10, w: 80, h: 80 })
const gridMode = ref<'none' | 'thirds' | 'golden' | 'cross'>('thirds')
// 导出边框修剪（像素），独立于预览，用于手动去除白边
const trimPx = ref({ top: 0, bottom: 0, left: 0, right: 0 })
// 画布扩展填充色
const fillColor = ref('transparent')

// 历史记录状态
interface CropState {
  rotation: number
  flipH: boolean
  flipV: boolean
  internalCrop: { x: number; y: number; w: number; h: number }
}
const history = ref<CropState[]>([])
const historyIndex = ref(-1)

interface EyeDropper {
  open: (options?: { signal?: AbortSignal }) => Promise<{ sRGBHex: string }>
}

const isEyeDropperSupported = typeof globalThis !== 'undefined' && 'EyeDropper' in globalThis

const { isProcessing, processSelected, processSingle } = useImageProcessor(cropEngine)

const handleEyeDropper = async () => {
  if (!isEyeDropperSupported) return
  try {
    const EyeDropperClass = (globalThis as any).EyeDropper
    const dropper = new EyeDropperClass() as EyeDropper
    const result = await dropper.open()
    fillColor.value = result.sRGBHex
  } catch {
    // 用户取消吸色或 API 调用失败
  }
}

// --- 业务函数 (Functions) ---

const handleReset = () => {
  rotation.value = 0
  flipH.value = false
  flipV.value = false
  currentRatio.value = undefined
  internalCrop.value = { x: 10, y: 10, w: 80, h: 80 }
  trimPx.value = { top: 0, bottom: 0, left: 0, right: 0 }
  fillColor.value = 'transparent'
}

const handleFit = () => {
  currentRatio.value = undefined
  internalCrop.value = { x: 0, y: 0, w: 100, h: 100 }
}

const applyState = (state: CropState) => {
  rotation.value = state.rotation
  flipH.value = state.flipH
  flipV.value = state.flipV
  internalCrop.value = { ...state.internalCrop }
}

const saveState = () => {
  const newState: CropState = {
    rotation: rotation.value,
    flipH: flipH.value,
    flipV: flipV.value,
    internalCrop: { ...internalCrop.value }
  }

  const currentState = history.value[historyIndex.value]
  if (currentState && JSON.stringify(currentState) === JSON.stringify(newState)) return

  history.value = history.value.slice(0, historyIndex.value + 1)
  history.value.push(newState)

  if (history.value.length > 20) {
    history.value.shift()
  } else {
    historyIndex.value++
  }
}

const handleUndo = () => {
  if (historyIndex.value > 0) {
    historyIndex.value--
    const state = history.value[historyIndex.value]
    if (state) applyState(state)
  }
}

const handleRedo = () => {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    const state = history.value[historyIndex.value]
    if (state) applyState(state)
  }
}

const handleRotate = () => {
  rotation.value = (rotation.value + 90) % 360
}

const handleFlipH = () => {
  flipH.value = !flipH.value
}

const handleFlipV = () => {
  flipV.value = !flipV.value
}

const handleApply = async () => {
  if (!selectedImage.value || isProcessing.value) return

  if (
    store.selectedCount > 5 &&
    !confirm(`确定要同时裁剪选中的 ${store.selectedCount} 张图片吗？`)
  ) {
    return
  }

  const options = {
    x: internalCrop.value.x,
    y: internalCrop.value.y,
    width: internalCrop.value.w,
    height: internalCrop.value.h,
    usePercentage: true,
    rotation: rotation.value,
    flipH: flipH.value,
    flipV: flipV.value,
    quality: Math.max(0.1, Math.min(1.0, outputQuality.value)),
    format: outputFormat.value === 'original' ? undefined : outputFormat.value,
    preserveExif: preserveExif.value,
    trimPx: {
      top: trimPx.value.top,
      bottom: trimPx.value.bottom,
      left: trimPx.value.left,
      right: trimPx.value.right
    },
    fillColor: fillColor.value
  }

  if (store.selectedCount > 0) {
    await processSelected(options)
  } else {
    await processSingle(selectedImage.value.id, options)
  }
}

// --- 计算属性 (Computed) ---

const selectedImage = computed(() => {
  return store.images.find((img) => img.id === selectedImageId.value) || store.images[0]
})

const pixelValues = computed(() => {
  if (!selectedImage.value) return { x: 0, y: 0, w: 0, h: 0 }
  const { width = 0, height = 0 } = selectedImage.value
  return {
    x: Math.round((internalCrop.value.x / 100) * width),
    y: Math.round((internalCrop.value.y / 100) * height),
    w: Math.round((internalCrop.value.w / 100) * width),
    h: Math.round((internalCrop.value.h / 100) * height)
  }
})

const estimatedSize = computed(() => {
  if (!selectedImage.value) return null
  const { originalSize } = selectedImage.value
  const areaRatio = (internalCrop.value.w * internalCrop.value.h) / 10000
  const qualityFactor = outputFormat.value === 'image/png' ? 1 : outputQuality.value
  const formatFactor = outputFormat.value === 'image/webp' ? 0.7 : 1

  const estimated = originalSize * areaRatio * qualityFactor * formatFactor
  if (estimated > 1024 * 1024) return (estimated / (1024 * 1024)).toFixed(2) + ' MB'
  return (estimated / 1024).toFixed(0) + ' KB'
})

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

const aspectRatios = [
  { label: '自由', value: 0, icon: 'M4 4h16v16H4z' },
  { label: '1:1', value: 1, icon: 'M6 6h12v12H6z' },
  { label: '4:3', value: 4 / 3, icon: 'M5 6h14v12H5z' },
  { label: '16:9', value: 16 / 9, icon: 'M3 7h18v10H3z' },
  { label: '9:16', value: 9 / 16, icon: 'M7 3h10v18H7z' },
  { label: '2:3', value: 2 / 3, icon: 'M6 4h12v16H6z' }
]

const formatOptions = [
  { label: '保留原格式', value: 'original' },
  { label: 'JPEG', value: 'image/jpeg' },
  { label: 'PNG', value: 'image/png' },
  { label: 'WebP', value: 'image/webp' }
]

const buttonText = computed(() => {
  if (isProcessing.value) return '正在批量处理...'
  if (store.selectedCount > 0) return `裁剪选中的 ${store.selectedCount} 张图片`
  if (store.images.length > 1) return `应用此裁剪到所有图片 (${store.images.length})`
  return '应用裁剪并保存'
})

// --- 副作用与监听 (Watchers) ---

watch(
  selectedImageId,
  () => {
    history.value = []
    historyIndex.value = -1
    handleReset()
    setTimeout(saveState, 100)
  },
  { immediate: true }
)

watch(
  () => store.images.length,
  (newLen) => {
    if (newLen > 0 && !selectedImageId.value) {
      selectedImageId.value = store.images[0]?.id || null
    } else if (newLen === 0) {
      selectedImageId.value = null
    }
  },
  { immediate: true }
)

let saveTimer: ReturnType<typeof setTimeout> | null = null
watch(
  [rotation, flipH, flipV, internalCrop],
  () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveState, 500)
  },
  { deep: true }
)
</script>

<template>
  <div class="h-full flex flex-col">
    <WorkspaceLayout show-sidebar no-scroll>
      <template #header-left>
        <ImageSelectionStatus />
      </template>

      <template #header-actions>
        <ImageActionsToolbar
          :is-processing="isProcessing"
          show-clear-all
          zip-prefix="_Imago_Cropped"
        />
      </template>

      <template #content>
        <div class="flex-1 flex flex-col p-4 md:p-6 lg:p-8 overflow-hidden min-h-0">
          <!-- 裁剪主区域 -->
          <div
            class="flex-1 bg-muted/10 backdrop-blur-sm rounded-xl border border-border/40 flex items-center justify-center relative overflow-hidden min-h-0"
            style="
              background-image:
                linear-gradient(45deg, hsl(var(--border) / 0.1) 25%, transparent 25%),
                linear-gradient(-45deg, hsl(var(--border) / 0.1) 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, hsl(var(--border) / 0.1) 75%),
                linear-gradient(-45deg, transparent 75%, hsl(var(--border) / 0.1) 75%);
              background-size: 16px 16px;
              background-position:
                0 0,
                0 8px,
                8px -8px,
                -8px 0px;
            "
          >
            <div
              v-if="selectedImage"
              class="absolute inset-0 transition-transform duration-500 will-change-transform flex items-center justify-center"
              :style="{
                transform: `rotate(${rotation}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`
              }"
            >
              <CropBox
                v-model="internalCrop"
                :image-url="selectedImage.preview"
                :aspect-ratio="currentRatio"
                :grid-mode="gridMode"
                :fill-color="fillColor"
              />
            </div>

            <div v-else class="flex flex-col items-center gap-4 text-muted-foreground/40">
              <Scissors :size="64" stroke-width="1" />
              <p class="text-xs font-bold uppercase tracking-widest">请选择图片开始裁剪</p>
            </div>
          </div>

          <!-- 批量处理同步提示 - Clarify -->
          <div
            v-if="store.selectedCount > 1"
            class="mt-4 px-6 py-3 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2"
          >
            <Info :size="16" class="text-primary" />
            <p class="text-[0.7rem] font-medium text-primary/80">
              当前模式：裁剪区域将同步应用至所有选中的
              <span class="font-bold underline">{{ store.selectedCount }}</span> 张图片。
            </p>
          </div>
        </div>
      </template>

      <template #sidebar>
        <div class="flex flex-col h-full bg-card/40 backdrop-blur-lg border-l border-border/50">
          <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10">
            <!-- 1. 变换与历史 -->
            <section class="space-y-4">
              <AppSectionHeader title="变换与历史" :icon="RotateCw" />
              <div class="bg-muted/10 p-4 rounded-2xl border border-border/40 space-y-4">
                <div class="grid grid-cols-4 gap-2">
                  <button
                    @click="handleRotate"
                    aria-label="顺时针旋转90度"
                    class="group aspect-square flex flex-col items-center justify-center gap-1.5 rounded-xl bg-background border border-border hover:border-primary/40 hover:text-primary transition-all active:scale-90 text-muted-foreground"
                  >
                    <RotateCw
                      :size="18"
                      class="opacity-60 group-hover:opacity-100 transition-opacity"
                    />
                    <span class="text-[0.65rem] font-bold opacity-60 group-hover:opacity-100"
                      >旋转</span
                    >
                  </button>
                  <button
                    @click="handleFlipH"
                    aria-label="水平翻转"
                    :class="{ 'bg-primary/10 border-primary text-primary': flipH }"
                    class="group aspect-square flex flex-col items-center justify-center gap-1.5 rounded-xl bg-background border border-border hover:border-primary/40 hover:text-primary transition-all active:scale-90 text-muted-foreground"
                  >
                    <FlipHorizontal
                      :size="18"
                      class="opacity-60 group-hover:opacity-100 transition-opacity"
                    />
                    <span class="text-[0.65rem] font-bold opacity-60 group-hover:opacity-100"
                      >水平</span
                    >
                  </button>
                  <button
                    @click="handleFlipV"
                    aria-label="垂直翻转"
                    :class="{ 'bg-primary/10 border-primary text-primary': flipV }"
                    class="group aspect-square flex flex-col items-center justify-center gap-1.5 rounded-xl bg-background border border-border hover:border-primary/40 hover:text-primary transition-all active:scale-90 text-muted-foreground"
                  >
                    <FlipVertical
                      :size="18"
                      class="opacity-60 group-hover:opacity-100 transition-opacity"
                    />
                    <span class="text-[0.65rem] font-bold opacity-60 group-hover:opacity-100"
                      >垂直</span
                    >
                  </button>
                  <button
                    @click="handleReset"
                    aria-label="重置所有变换"
                    class="group aspect-square flex flex-col items-center justify-center gap-1.5 rounded-xl bg-background border border-border hover:text-destructive hover:border-destructive/40 transition-all active:scale-90 text-muted-foreground"
                  >
                    <RefreshCcw
                      :size="18"
                      class="opacity-60 group-hover:opacity-100 transition-opacity"
                    />
                    <span class="text-[0.65rem] font-bold opacity-60 group-hover:opacity-100"
                      >重置</span
                    >
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                  <button
                    @click="handleUndo"
                    aria-label="撤销"
                    :disabled="!canUndo"
                    class="group h-9 flex items-center justify-center gap-2 rounded-xl bg-background border border-border hover:border-primary/40 hover:text-primary transition-all active:scale-95 disabled:opacity-30 disabled:grayscale text-muted-foreground"
                  >
                    <Undo2
                      :size="14"
                      class="opacity-60 group-hover:opacity-100 transition-opacity"
                    />
                    <span class="text-[0.65rem] font-bold opacity-60 group-hover:opacity-100"
                      >撤销</span
                    >
                  </button>
                  <button
                    @click="handleRedo"
                    aria-label="重回"
                    :disabled="!canRedo"
                    class="group h-9 flex items-center justify-center gap-2 rounded-xl bg-background border border-border hover:border-primary/40 hover:text-primary transition-all active:scale-95 disabled:opacity-30 disabled:grayscale text-muted-foreground"
                  >
                    <Redo2
                      :size="14"
                      class="opacity-60 group-hover:opacity-100 transition-opacity"
                    />
                    <span class="text-[0.65rem] font-bold opacity-60 group-hover:opacity-100"
                      >重做</span
                    >
                  </button>
                </div>
              </div>
            </section>

            <!-- 2. 裁剪比例与精确控制 -->
            <section class="space-y-4">
              <div class="flex items-center justify-between">
                <AppSectionHeader title="裁剪区域" :icon="Maximize2" />
                <div class="flex items-center gap-2">
                  <button
                    @click="handleFit"
                    class="px-2 py-1 rounded text-[0.7rem] font-bold text-primary/80 hover:text-primary hover:bg-primary/10 transition-all"
                  >
                    铺满
                  </button>
                  <div class="flex gap-1 bg-muted/20 p-1 rounded-lg border border-border/40">
                    <button
                      v-for="mode in ['thirds', 'golden', 'none'] as const"
                      :key="mode"
                      @click="gridMode = mode"
                      class="px-2 py-1 rounded text-[0.65rem] font-bold transition-all"
                      :class="
                        gridMode === mode
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground/60 hover:text-foreground'
                      "
                    >
                      {{ mode === 'thirds' ? '九宫' : mode === 'golden' ? '黄金' : '无' }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="ratio in aspectRatios"
                  :key="ratio.label"
                  @click="currentRatio = ratio.value || undefined"
                  class="group flex flex-col items-center gap-2 py-3 rounded-xl border text-[0.7rem] font-bold transition-all active:scale-95 relative"
                  :class="
                    currentRatio === ratio.value ||
                    (ratio.value === 0 && currentRatio === undefined)
                      ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'bg-background border-border text-muted-foreground hover:text-primary hover:border-primary/40'
                  "
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="w-5 h-5 mb-0.5 opacity-40 group-hover:opacity-100 transition-opacity"
                    :class="
                      currentRatio === ratio.value ||
                      (ratio.value === 0 && currentRatio === undefined)
                        ? 'fill-current'
                        : 'fill-muted-foreground'
                    "
                  >
                    <path :d="ratio.icon" />
                  </svg>
                  {{ ratio.label }}
                </button>
              </div>

              <!-- 扩图底色填充 -->
              <div class="space-y-3 pt-4 border-t border-border/30">
                <div class="flex items-center justify-between px-1">
                  <span
                    class="text-[0.7rem] font-bold text-muted-foreground/60 uppercase tracking-wider"
                    >画布扩展填充</span
                  >
                  <span
                    v-if="fillColor !== 'transparent'"
                    class="text-[0.65rem] font-mono text-muted-foreground/50"
                    >{{ fillColor.toUpperCase() }}</span
                  >
                </div>

                <div class="flex items-center gap-2.5 px-1">
                  <!-- 快速选择组：透明、白、黑 -->
                  <div
                    class="flex items-center gap-1.5 p-1 bg-muted/30 rounded-xl border border-border/40 shadow-inner-glow shrink-0"
                  >
                    <!-- 透明 -->
                    <button
                      @click="fillColor = 'transparent'"
                      class="w-8 h-8 rounded-lg transition-all flex items-center justify-center overflow-hidden border-[1.5px] relative group/color"
                      :class="
                        fillColor === 'transparent'
                          ? 'border-primary ring-2 ring-primary/10 shadow-sm'
                          : 'border-transparent hover:bg-background/60'
                      "
                      title="透明"
                    >
                      <div class="w-full h-full opacity-40 transparency-grid-small"></div>
                      <div
                        v-if="fillColor !== 'transparent'"
                        class="absolute inset-0 flex items-center justify-center opacity-0 group-hover/color:opacity-100 transition-opacity"
                      >
                        <X :size="10" class="text-muted-foreground/40" />
                      </div>
                    </button>
                    <!-- 纯白 -->
                    <button
                      @click="fillColor = '#FFFFFF'"
                      class="w-8 h-8 rounded-lg border-[1.5px] transition-all bg-white shadow-sm"
                      :class="
                        fillColor === '#FFFFFF'
                          ? 'border-primary ring-2 ring-primary/10'
                          : 'border-border/20 hover:border-primary/30'
                      "
                      title="纯白"
                    ></button>
                    <!-- 纯黑 -->
                    <button
                      @click="fillColor = '#000000'"
                      class="w-8 h-8 rounded-lg border-[1.5px] transition-all bg-black shadow-sm"
                      :class="
                        fillColor === '#000000'
                          ? 'border-primary ring-2 ring-primary/10'
                          : 'border-border/20 hover:border-primary/30'
                      "
                      title="纯黑"
                    ></button>
                  </div>

                  <div class="w-[1.5px] h-8 bg-border/20 rounded-full mx-0.5 shrink-0"></div>

                  <!-- 自定义与吸色组 -->
                  <div class="flex-1 flex items-center gap-2 min-w-0">
                    <!-- 吸色器 -->
                    <button
                      v-if="isEyeDropperSupported"
                      @click="handleEyeDropper"
                      class="w-9 h-9 rounded-xl border border-border/40 bg-background flex items-center justify-center hover:border-primary/40 hover:text-primary transition-all active:scale-90 text-muted-foreground shrink-0 shadow-sm"
                      title="从屏幕吸色"
                    >
                      <Pipette :size="14" />
                    </button>

                    <!-- 自定义颜色输入 -->
                    <label class="relative flex-1 h-9 group cursor-pointer min-w-0">
                      <input
                        type="color"
                        v-model="fillColor"
                        class="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                      />
                      <div
                        class="w-full h-full rounded-xl border border-border/40 bg-background flex items-center px-2 gap-2 group-hover:border-primary/40 transition-all shadow-sm overflow-hidden"
                        :class="
                          !['transparent', '#FFFFFF', '#000000'].includes(fillColor)
                            ? 'border-primary/60 bg-primary/5'
                            : ''
                        "
                      >
                        <div
                          class="w-4 h-4 rounded shadow-inner shrink-0 border border-black/5"
                          :style="{
                            background: ['transparent'].includes(fillColor)
                              ? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)'
                              : fillColor
                          }"
                        ></div>
                        <span
                          class="text-[0.65rem] font-black text-muted-foreground truncate uppercase tracking-tighter"
                        >
                          {{
                            !['transparent', '#FFFFFF', '#000000'].includes(fillColor)
                              ? fillColor
                              : 'Custom'
                          }}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
                <p class="text-[0.65rem] text-muted-foreground/50 px-1 leading-tight italic">
                  拖拽裁剪框超出图片边界将自动填充背景色。
                </p>
              </div>

              <!-- 精确数值输入 -->
              <div class="grid grid-cols-2 gap-x-4 gap-y-4 pt-4 border-t border-border/30">
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between px-1">
                    <label
                      for="crop-x"
                      class="text-[0.7rem] font-bold text-muted-foreground/60 uppercase tracking-wider cursor-pointer"
                      >X (%)</label
                    >
                    <span class="text-xs font-mono text-muted-foreground/40"
                      >{{ pixelValues.x }}px</span
                    >
                  </div>
                  <AppInput
                    id="crop-x"
                    v-model.number="internalCrop.x"
                    type="number"
                    :min="0"
                    :max="95"
                    class="h-9 text-xs"
                  />
                </div>
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between px-1">
                    <label
                      for="crop-y"
                      class="text-[0.7rem] font-bold text-muted-foreground/60 uppercase tracking-wider cursor-pointer"
                      >Y (%)</label
                    >
                    <span class="text-xs font-mono text-muted-foreground/40"
                      >{{ pixelValues.y }}px</span
                    >
                  </div>
                  <AppInput
                    id="crop-y"
                    v-model.number="internalCrop.y"
                    type="number"
                    :min="0"
                    :max="95"
                    class="h-9 text-xs"
                  />
                </div>
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between px-1">
                    <label
                      for="crop-w"
                      class="text-[0.7rem] font-bold text-muted-foreground/60 uppercase tracking-wider cursor-pointer"
                      >Width (%)</label
                    >
                    <span class="text-xs font-mono text-primary/60 font-bold"
                      >{{ pixelValues.w }}px</span
                    >
                  </div>
                  <AppInput
                    id="crop-w"
                    v-model.number="internalCrop.w"
                    type="number"
                    :min="5"
                    :max="100"
                    class="h-9 text-xs"
                  />
                </div>
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between px-1">
                    <label
                      for="crop-h"
                      class="text-[0.7rem] font-bold text-muted-foreground/60 uppercase tracking-wider cursor-pointer"
                      >Height (%)</label
                    >
                    <span class="text-xs font-mono text-primary/60 font-bold"
                      >{{ pixelValues.h }}px</span
                    >
                  </div>
                  <AppInput
                    id="crop-h"
                    v-model.number="internalCrop.h"
                    type="number"
                    :min="5"
                    :max="100"
                    class="h-9 text-xs"
                  />
                </div>
              </div>
            </section>

            <!-- 3. 输出设置 -->
            <section class="space-y-4">
              <div class="flex items-center justify-between">
                <AppSectionHeader title="导出设置" :icon="FileType" />
                <div
                  v-if="estimatedSize"
                  class="px-2 py-1 bg-primary/10 border border-primary/20 rounded-lg text-[0.55rem] font-mono text-primary font-bold"
                >
                  ~ {{ estimatedSize }}
                </div>
              </div>
              <div class="space-y-5 bg-muted/10 p-5 rounded-2xl border border-border/40">
                <AppSelect v-model="outputFormat" :options="formatOptions" />
                <div
                  v-if="outputFormat !== 'image/png' && outputFormat !== 'original'"
                  class="space-y-3"
                >
                  <AppSlider
                    v-model="outputQuality"
                    label="画质"
                    :min="0.1"
                    :max="1.0"
                    :step="0.05"
                    unit=""
                  />
                </div>

                <!-- 边框修剪 -->
                <div class="space-y-2 pt-2 border-t border-border/30">
                  <div class="flex items-center justify-between px-0.5">
                    <span
                      class="text-[0.7rem] font-bold text-muted-foreground/60 uppercase tracking-wider"
                      >边框修剪 (px)</span
                    >
                    <button
                      v-if="trimPx.top || trimPx.bottom || trimPx.left || trimPx.right"
                      @click="trimPx = { top: 0, bottom: 0, left: 0, right: 0 }"
                      class="text-[0.65rem] text-muted-foreground/40 hover:text-destructive transition-colors font-bold"
                    >
                      重置
                    </button>
                  </div>
                  <div class="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <div
                      v-for="edge in [
                        ['top', '上 (px)'],
                        ['bottom', '下 (px)'],
                        ['left', '左 (px)'],
                        ['right', '右 (px)']
                      ] as const"
                      :key="edge[0]"
                      class="space-y-1"
                    >
                      <span
                        class="text-[0.65rem] font-bold text-muted-foreground/40 uppercase tracking-wider px-1"
                        >{{ edge[1] }}</span
                      >
                      <AppInput
                        v-model.number="trimPx[edge[0]]"
                        type="number"
                        :min="0"
                        :max="20"
                        class="h-9 text-xs"
                      />
                    </div>
                  </div>
                  <p class="text-[0.65rem] text-muted-foreground/40 px-0.5 italic">
                    仅影响导出，不改变预览框位置
                  </p>
                </div>
              </div>
            </section>

            <!-- 4. 待处理队列 -->
            <section class="space-y-4 pb-4">
              <AppSectionHeader title="队列" :icon="ListOrdered" />
              <div class="space-y-2 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                <div
                  v-for="img in store.images"
                  :key="img.id"
                  class="flex items-center gap-3 p-2 rounded-xl cursor-pointer border transition-all group"
                  :class="
                    selectedImageId === img.id
                      ? 'bg-primary/5 border-primary/40'
                      : 'border-transparent bg-muted/20 hover:bg-muted/40'
                  "
                  @click="selectedImageId = img.id"
                >
                  <div
                    class="flex shrink-0 transition-colors"
                    @click.stop="store.toggleSelection(img.id)"
                  >
                    <CheckSquare
                      v-if="store.selectedIds.has(img.id)"
                      :size="16"
                      class="text-primary"
                    />
                    <Square
                      v-else
                      :size="16"
                      class="text-muted-foreground/30 group-hover:text-muted-foreground/60"
                    />
                  </div>

                  <div class="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-border/30">
                    <img :src="img.preview" class="w-full h-full object-cover" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[0.7rem] font-bold text-muted-foreground/90 truncate">
                      {{ img.file.name }}
                    </p>
                    <p class="text-[0.65rem] text-muted-foreground/40 font-mono mt-0.5">
                      {{ img.width }}x{{ img.height }}
                    </p>
                  </div>
                  <button
                    @click.stop="store.removeImage(img.id)"
                    class="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
                  >
                    <X :size="14" />
                  </button>
                </div>
              </div>
            </section>
          </div>

          <!-- 底部执行 -->
          <div class="p-6 mt-auto border-t border-border/30 shrink-0">
            <AppButton
              size="lg"
              variant="cta"
              class="w-full h-12 rounded-xl shadow-lg shadow-primary/10"
              :loading="isProcessing"
              :disabled="!selectedImage"
              @click="handleApply"
            >
              <template #icon><Scissors v-if="!isProcessing" :size="16" class="mr-2" /></template>
              {{ buttonText }}
            </AppButton>
          </div>
        </div>
      </template>
    </WorkspaceLayout>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--border) / 0.5);
  border-radius: 10px;
}

.transparency-grid-small {
  background-image: conic-gradient(
    hsl(var(--muted-foreground) / 0.2) 0 25%,
    transparent 0 50%,
    hsl(var(--muted-foreground) / 0.2) 0 75%,
    transparent 0
  );
  background-size: 8px 8px;
}
</style>
