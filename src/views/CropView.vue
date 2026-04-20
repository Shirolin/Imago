<script setup lang="ts">
import { ref, computed, watch, h, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '../stores/imageStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import CropBox from '../components/common/CropBox.vue'
import AppCanvasWorkspace from '../components/common/AppCanvasWorkspace.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import AppModal from '../components/common/AppModal.vue'
import {
  Scissors,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Grid3X3,
  Square,
  RotateCcw,
  Undo2,
  Redo2,
  Settings2,
  LayoutGrid,
  Link as LinkIcon,
  Unlink,
  History,
  Download,
  AlertCircle
} from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppInput from '../components/common/AppInput.vue'
import AppColorPicker from '../components/common/AppColorPicker.vue'
import { cropEngine } from '../lib/engines/cropEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useResizeObserver, useDebounceFn } from '@vueuse/core'
import { useHistory } from '../composables/useHistory'
import { useFileHelpers } from '../composables/useFileHelpers'
import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const { downloadImage } = useFileHelpers()
const { t } = useI18n()

const createRatioIcon = (width: number, height: number) => {
  return () =>
    h(
      'svg',
      {
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        style: { width: '100%', height: '100%' }
      },
      [h('rect', { x: (24 - width) / 2, y: (24 - height) / 2, width, height, rx: '1.5' })]
    )
}
const Icon43 = createRatioIcon(18, 14)
const Icon169 = createRatioIcon(20, 11)
const Icon23 = createRatioIcon(13, 19)

// --- 状态 ---
const rotation = ref(0)
const flipH = ref(false)
const flipV = ref(false)
const currentRatio = ref<number>(0)
const outputQuality = ref(0.92)
const outputFormat = ref<string>('original')
const preserveExif = ref(false)
const fillColor = ref('transparent')
const internalCrop = ref({ x: 0, y: 0, w: 100, h: 100 })
const gridMode = ref<'none' | 'thirds' | 'golden' | 'cross'>('thirds')
const trimPx = ref({ top: 0, bottom: 0, left: 0, right: 0 })

interface CropSettings {
  rotation: number
  flipH: boolean
  flipV: boolean
  currentRatio: number
  outputQuality: number
  outputFormat: string
  preserveExif: boolean
  fillColor: string
  internalCrop: { x: number; y: number; w: number; h: number }
  gridMode: 'none' | 'thirds' | 'golden' | 'cross'
  trimPx: { top: number; bottom: number; left: number; right: number }
}

const allSettings = computed<CropSettings>({
  get: () => ({
    rotation: rotation.value,
    flipH: flipH.value,
    flipV: flipV.value,
    currentRatio: currentRatio.value,
    outputQuality: outputQuality.value,
    outputFormat: outputFormat.value,
    preserveExif: preserveExif.value,
    fillColor: fillColor.value,
    internalCrop: { ...internalCrop.value },
    gridMode: gridMode.value,
    trimPx: { ...trimPx.value }
  }),
  set: (v) => {
    rotation.value = v.rotation
    flipH.value = v.flipH
    flipV.value = v.flipV
    currentRatio.value = v.currentRatio
    outputQuality.value = v.outputQuality
    outputFormat.value = v.outputFormat
    preserveExif.value = v.preserveExif
    fillColor.value = v.fillColor
    internalCrop.value = { ...v.internalCrop }
    gridMode.value = v.gridMode
    trimPx.value = { ...v.trimPx }
  }
})

const { canUndo, canRedo, undo, redo, commit, clear: clearHistory } = useHistory(allSettings)

// 立即提交：用于离散操作（旋转、翻转、比例切换）
const recordImmediate = () => commit()

// 防抖提交：用于高频更新（输入框输入）
const recordDebounced = useDebounceFn(() => commit(), 400)

const handleRotate = () => {
  recordImmediate()
  rotation.value = (rotation.value + 90) % 360
}
const handleFlipH = () => {
  recordImmediate()
  flipH.value = !flipH.value
}
const handleFlipV = () => {
  recordImmediate()
  flipV.value = !flipV.value
}
const handleRatioChange = (val: number) => {
  if (currentRatio.value === val) return
  recordImmediate()
  currentRatio.value = val
}

const handleFillImage = () => {
  recordImmediate()
  currentRatio.value = 0
  internalCrop.value = { x: 0, y: 0, w: 100, h: 100 }
}

const isDragging = ref(false)
const isSnapping = ref(false)

const { isProcessing, processSingle } = useImageProcessor(cropEngine)
const selectedImage = computed(() => store.activeImage)

const workspaceRef = ref<InstanceType<typeof AppCanvasWorkspace> | null>(null)
const containerRef = computed(() => workspaceRef.value?.containerRef)

const resetView = () => {
  const img = selectedImage.value
  if (!img || !img.width) return
  // 如果旋转了 90 或 270 度，交换宽高以确保画布能正确包住旋转后的图片
  const isRotated = rotation.value % 180 !== 0
  const w = isRotated ? img.height! : img.width
  const h = isRotated ? img.width : img.height!
  workspaceRef.value?.triggerAutoFit(w, h)
}

const pxCoords = computed({
  get: () => {
    const img = selectedImage.value
    if (!img || !img.width || !img.height) return { x: 0, y: 0, w: 0, h: 0 }
    return {
      x: Math.round((internalCrop.value.x / 100) * img.width),
      y: Math.round((internalCrop.value.y / 100) * img.height),
      w: Math.round((internalCrop.value.w / 100) * img.width),
      h: Math.round((internalCrop.value.h / 100) * img.height)
    }
  },
  set: (val) => {
    const img = selectedImage.value
    if (!img || !img.width || !img.height) return
    internalCrop.value = {
      x: (val.x / img.width) * 100,
      y: (val.y / img.height) * 100,
      w: (val.w / img.width) * 100,
      h: (val.h / img.height) * 100
    }
  }
})

const handlePxInputChange = (key: 'x' | 'y' | 'w' | 'h', val: number) => {
  // 输入框更新使用防抖提交
  recordDebounced()
  const newCoords = { ...pxCoords.value }
  newCoords[key] = val
  pxCoords.value = newCoords
}

const onCropChange = (data: {
  x: number
  y: number
  w: number
  h: number
  isDragging: boolean
  isSnapping: boolean
}) => {
  // 核心优化：仅在拖拽开始和结束时记录
  if (data.isDragging && !isDragging.value) {
    recordImmediate() // 记录动作前的原始状态
  } else if (!data.isDragging && isDragging.value) {
    recordImmediate() // 记录动作后的最终状态
  }
  isDragging.value = data.isDragging
  isSnapping.value = data.isSnapping
}

useResizeObserver(containerRef, resetView)
// 确认框状态
const showResetConfirm = ref(false)

const handleReset = () => {
  showResetConfirm.value = true
}

const confirmReset = () => {
  rotation.value = 0
  flipH.value = false
  flipV.value = false
  currentRatio.value = 0
  internalCrop.value = { x: 0, y: 0, w: 100, h: 100 }
  trimPx.value = { top: 0, bottom: 0, left: 0, right: 0 }
  fillColor.value = 'transparent'
  clearHistory()
  resetView()
  showResetConfirm.value = false
}

// --- 快捷键管理 ---
const handleKeyDown = (e: KeyboardEvent) => {
  const isUndo = (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey
  const isRedo = (e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'Z' && e.shiftKey))

  // 确保不在输入框内触发
  const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
  if (isInput) return

  if (isUndo && canUndo.value) {
    e.preventDefault()
    undo()
  } else if (isRedo && canRedo.value) {
    e.preventDefault()
    redo()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))

// 【核心优化】：图片切换时强制重置所有参数，确保状态隔离
watch(
  () => store.activeId,
  () => {
    handleReset()
  },
  { immediate: true }
)

// 【状态驱动】：监听所有配置变化，自动标记为“脏数据”以激活“更新裁剪”按钮
watch(
  () => allSettings.value,
  () => {
    if (store.activeId) {
      store.markDirty(store.activeId)
    }
  },
  { deep: true }
)

const ctaState = computed(() => {
  const img = selectedImage.value
  if (!img)
    return { text: t('tools.crop.cta.select'), icon: Scissors, action: 'none', disabled: true }

  if (isProcessing.value) {
    return { text: t('common.processing'), icon: Scissors, action: 'none', disabled: true }
  }

  // 如果已经处理完成且没有新改动 -> 显示下载 (绿色)
  if (img.status === 'done' && img.processedBlob && !img.isDirty) {
    return {
      text: t('tools.crop.cta.export', { count: 1 }),
      icon: Download,
      action: 'download',
      disabled: false
    }
  }

  // 默认 -> 应用裁剪 (蓝色)
  return {
    text: img.isDirty
      ? t('tools.crop.cta.apply', { count: 1 })
      : t('tools.crop.cta.apply', { count: 1 }),
    icon: Scissors,
    action: 'process',
    disabled: false
  }
})

const handleCtaClick = async () => {
  const state = ctaState.value
  if (state.action === 'none') return

  const img = selectedImage.value
  if (!img) return

  if (state.action === 'download' && img.processedBlob) {
    downloadImage(img.processedBlob, img.file.name, t('common.export.suffix.cropped'))
    return
  }

  if (state.action === 'process') {
    await processSingle(img.id, {
      x: internalCrop.value.x,
      y: internalCrop.value.y,
      width: internalCrop.value.w,
      height: internalCrop.value.h,
      usePercentage: true,
      rotation: rotation.value,
      flipH: flipH.value,
      flipV: flipV.value,
      fillColor: fillColor.value,
      trimPx: trimPx.value,
      format: outputFormat.value === 'original' ? undefined : outputFormat.value,
      quality: outputQuality.value,
      preserveExif: preserveExif.value
    })
  }
}

const ratios = computed(() => [
  { label: t('tools.crop.freeRatio'), value: 0, icon: Scissors },
  { label: '1:1', value: 1, icon: Square },
  { label: '4:3', value: 4 / 3, icon: Icon43 },
  { label: '16:9', value: 16 / 9, icon: Icon169 },
  { label: '2:3', value: 2 / 3, icon: Icon23 }
])
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
    <template #header-left><ImageSelectionStatus :show-card-size="false" /></template>
    <template #header-actions
      ><ImageActionsToolbar
        view-id="crop"
        :is-processing="isProcessing"
        show-clear-all
        show-reset-all
    /></template>

    <template #content>
      <AppCanvasWorkspace ref="workspaceRef" @reset="resetView">
        <template #default="{ scale }">
          <div v-if="selectedImage" class="relative z-10">
            <CropBox
              :image-url="selectedImage.preview"
              :aspect-ratio="currentRatio"
              v-model="internalCrop"
              :grid-mode="gridMode"
              :fill-color="fillColor"
              :scale="scale"
              :rotation="rotation"
              :flip-h="flipH"
              :flip-v="flipV"
              :is-hand-mode="workspaceRef?.isHandMode"
              @change="onCropChange"
            />
          </div>
        </template>

        <template #floating>
          <div
            class="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-3 z-40 transition-opacity duration-300"
            :class="isDragging ? 'opacity-100' : 'opacity-0'"
          >
            <div
              v-if="isSnapping"
              class="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-lg"
            >
              {{ t('tools.crop.snapped') }}
            </div>

            <div class="flex flex-col items-center gap-1.5">
              <div
                class="px-4 py-2 bg-card/90 text-foreground rounded-xl border border-border/40 text-xs font-mono font-bold shadow-xl backdrop-blur-md tabular-nums ring-1 ring-primary/5"
              >
                {{ pxCoords.w }} × {{ pxCoords.h }} PX
              </div>

              <!-- 下沉式功能提示：在这里显示双击重置，不遮挡拉手 -->
              <div
                class="px-2.5 py-1 bg-muted/20 backdrop-blur-sm rounded-lg border border-border/40 text-[9px] text-muted-foreground/60 font-medium tracking-tight flex items-center gap-1.5 shadow-sm"
              >
                <div class="w-1 h-1 rounded-full bg-primary/40"></div>
                {{ t('tools.crop.doubleClickReset') }}
              </div>
            </div>
          </div>
        </template>
      </AppCanvasWorkspace>
    </template>

    <template #sidebar>
      <!-- 第一分区：基础变换 (地基校准) -->
      <section class="space-y-4">
        <AppSectionHeader :title="t('tools.crop.basicTransform')" :icon="RotateCw" />
        <div class="bg-muted/10 rounded-2xl p-4 border border-border/60">
          <div class="grid grid-cols-3 gap-2">
            <button
              @click="handleRotate"
              class="flex flex-col items-center gap-2 p-3 rounded-xl border bg-background/50 hover:bg-primary/5 hover:border-primary/30 transition-all group"
              :title="t('tools.crop.rotateTip')"
            >
              <RotateCw
                :size="18"
                class="text-muted-foreground group-hover:text-primary transition-colors"
              /><span
                class="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter"
                >{{ t('tools.crop.rotate') }}</span
              >
            </button>
            <button
              @click="handleFlipH"
              class="flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group"
              :class="
                flipH
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-background/50 border-border text-muted-foreground hover:bg-primary/5 hover:border-primary/30'
              "
              :title="t('tools.crop.flipHTip')"
            >
              <FlipHorizontal :size="18" class="group-hover:text-primary transition-colors" /><span
                class="text-[9px] font-bold uppercase tracking-tighter"
                >{{ t('tools.crop.flipH') }}</span
              >
            </button>
            <button
              @click="handleFlipV"
              class="flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group"
              :class="
                flipV
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-background/50 border-border text-muted-foreground hover:bg-primary/5 hover:border-primary/30'
              "
              :title="t('tools.crop.flipVTip')"
            >
              <FlipVertical :size="18" class="group-hover:text-primary transition-colors" /><span
                class="text-[9px] font-bold uppercase tracking-tighter"
                >{{ t('tools.crop.flipV') }}</span
              >
            </button>
          </div>
        </div>
      </section>

      <!-- 第二分区：裁剪比例 (定形阶段) -->
      <section class="space-y-4 pt-6 border-t border-border/40">
        <AppSectionHeader :title="t('tools.crop.aspectRatio')" :icon="Scissors" />
        <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-4">
          <AppButton
            variant="secondary"
            class="w-full h-10 rounded-xl bg-background/50 border-dashed border-border hover:border-primary/50 hover:bg-primary/[0.02] group transition-all"
            @click="handleFillImage"
          >
            <Maximize2
              :size="16"
              class="mr-2 text-muted-foreground group-hover:text-primary transition-colors"
            />
            <span class="text-xs font-bold uppercase tracking-wider">{{
              t('tools.crop.fillAll')
            }}</span>
          </AppButton>

          <AppSegmentedControl
            v-model="currentRatio"
            :options="ratios"
            @update:model-value="handleRatioChange"
          />
          <div class="space-y-3 pt-1">
            <div class="flex items-center justify-between ml-1">
              <span
                class="text-[10px] font-black text-muted-foreground uppercase tracking-widest"
                >{{ t('tools.crop.gridLines') }}</span
              >
              <span class="text-[9px] text-muted-foreground/40 italic">{{
                t('tools.crop.gridLinesTip')
              }}</span>
            </div>
            <AppSegmentedControl
              v-model="gridMode"
              size="sm"
              grid-cols="2"
              :options="[
                { label: t('tools.crop.noGrid'), value: 'none', icon: Maximize2 },
                { label: t('tools.crop.thirds'), value: 'thirds', icon: Grid3X3 },
                { label: t('tools.crop.golden'), value: 'golden', icon: LayoutGrid }
              ]"
            />
          </div>
        </div>
      </section>

      <!-- 第三分区：精确构图 (精度微调) -->
      <section class="space-y-4 pt-6 border-t border-border/40">
        <AppSectionHeader :title="t('tools.crop.precision')" :icon="LayoutGrid" />
        <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-4">
          <div class="grid grid-cols-2 gap-x-3 gap-y-4 relative">
            <div class="space-y-1.5">
              <label
                class="text-[10px] font-black text-muted-foreground uppercase ml-1 tracking-widest"
                >{{ t('tools.crop.posX') }}</label
              >
              <AppInput
                type="number"
                :model-value="Math.round(pxCoords.x)"
                @update:model-value="handlePxInputChange('x', $event)"
                class="h-10 text-xs font-mono transition-all"
                :class="[
                  pxCoords.x < 0 || pxCoords.x + pxCoords.w > (selectedImage?.width || 0)
                    ? 'border-amber-500/40 bg-amber-500/[0.02] ring-1 ring-amber-500/10'
                    : 'bg-background/50'
                ]"
              />
            </div>
            <div class="space-y-1.5">
              <label
                class="text-[10px] font-black text-muted-foreground uppercase ml-1 tracking-widest"
                >{{ t('tools.crop.posY') }}</label
              >
              <AppInput
                type="number"
                :model-value="Math.round(pxCoords.y)"
                @update:model-value="handlePxInputChange('y', $event)"
                class="h-10 text-xs font-mono transition-all"
                :class="[
                  pxCoords.y < 0 || pxCoords.y + pxCoords.h > (selectedImage?.height || 0)
                    ? 'border-amber-500/40 bg-amber-500/[0.02] ring-1 ring-amber-500/10'
                    : 'bg-background/50'
                ]"
              />
            </div>

            <div class="col-span-2 grid grid-cols-2 gap-x-3 relative mt-1">
              <div class="space-y-1.5">
                <label
                  class="text-[10px] font-black uppercase ml-1 tracking-widest transition-colors"
                  :class="currentRatio > 0 ? 'text-primary' : 'text-muted-foreground'"
                  >{{ t('tools.crop.width') }}</label
                >
                <AppInput
                  type="number"
                  :model-value="Math.round(pxCoords.w)"
                  @update:model-value="handlePxInputChange('w', $event)"
                  class="h-10 text-xs font-mono transition-all"
                  :class="[
                    currentRatio > 0
                      ? 'border-primary/40 bg-primary/[0.03] ring-1 ring-primary/10'
                      : 'border-border bg-background/50',
                    pxCoords.w > (selectedImage?.width || 0)
                      ? 'border-amber-500/40 ring-1 ring-amber-500/10'
                      : ''
                  ]"
                />
              </div>

              <div
                class="absolute left-1/2 top-[2.1rem] -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center"
              >
                <div
                  class="bg-background border rounded-full p-1 shadow-sm transition-all duration-500"
                  :class="
                    currentRatio > 0
                      ? 'border-primary/40 text-primary scale-110 shadow-primary/10 rotate-0'
                      : 'border-border text-muted-foreground/40 scale-90 rotate-[-45deg]'
                  "
                >
                  <component :is="currentRatio > 0 ? LinkIcon : Unlink" :size="12" />
                </div>
              </div>

              <div class="space-y-1.5">
                <label
                  class="text-[10px] font-black uppercase ml-1 tracking-widest transition-colors"
                  :class="currentRatio > 0 ? 'text-primary' : 'text-muted-foreground'"
                  >{{ t('tools.crop.height') }}</label
                >
                <AppInput
                  type="number"
                  :model-value="Math.round(pxCoords.h)"
                  @update:model-value="handlePxInputChange('h', $event)"
                  class="h-10 text-xs font-mono transition-all"
                  :class="[
                    currentRatio > 0
                      ? 'border-primary/40 bg-primary/[0.03] ring-1 ring-primary/10'
                      : 'border-border bg-background/50',
                    pxCoords.h > (selectedImage?.height || 0)
                      ? 'border-amber-500/40 ring-1 ring-amber-500/10'
                      : ''
                  ]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 第四分区：画布外观 (环境配置) -->
      <section class="space-y-4 pt-6 border-t border-border/40">
        <AppSectionHeader :title="t('tools.crop.canvasAppearance')" :icon="Settings2" />
        <div class="bg-muted/10 rounded-2xl p-4 border border-border/60">
          <AppColorPicker v-model="fillColor" :label="t('tools.crop.bgFill')" />
        </div>
      </section>

      <!-- 第五分区：边缘精修 (TRIM) - 后处理阶段 -->
      <section class="space-y-4 pt-6 border-t border-border/40">
        <div class="flex items-center justify-between pr-1">
          <AppSectionHeader :title="t('tools.crop.edgeTrim')" :icon="Settings2" />
          <div class="text-[9px] text-amber-500 font-black uppercase tracking-widest italic">
            Post-Process
          </div>
        </div>
        <div class="bg-amber-500/5 rounded-2xl p-4 border border-amber-500/20 space-y-4">
          <div class="flex gap-3 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
            <div class="shrink-0 text-amber-500 mt-0.5">
              <Settings2 :size="14" />
            </div>
            <p class="text-[10px] text-amber-700/80 leading-relaxed font-medium">
              {{ t('tools.crop.trimWarning') }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div v-for="dir in ['top', 'bottom', 'left', 'right']" :key="dir" class="space-y-2">
              <label class="text-[9px] font-black text-muted-foreground uppercase ml-1">{{
                t('tools.crop.trim' + dir.charAt(0).toUpperCase() + dir.slice(1))
              }}</label>
              <AppInput
                type="number"
                v-model.number="trimPx[dir as keyof typeof trimPx]"
                :min="0"
                :max="100"
                class="bg-background/50 border-border/60 focus:border-amber-500/50"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- 第六分区：操作管理 (终结阶段) -->
      <section class="space-y-4 pt-6 border-t border-border/40 pb-4">
        <AppSectionHeader :title="t('tools.crop.history')" :icon="History" />
        <div class="flex items-center justify-between gap-3">
          <div class="flex-1 grid grid-cols-2 gap-2">
            <AppButton
              variant="secondary"
              size="sm"
              :disabled="!canUndo"
              @click="undo"
              class="rounded-xl h-10 text-[10px] font-bold uppercase bg-background/50 border-border/60 hover:bg-primary/[0.02]"
              ><Undo2 :size="14" class="mr-1.5" /> {{ t('tools.crop.undo') }}</AppButton
            >
            <AppButton
              variant="secondary"
              size="sm"
              :disabled="!canRedo"
              @click="redo"
              class="rounded-xl h-10 text-[10px] font-bold uppercase bg-background/50 border-border/60 hover:bg-primary/[0.02]"
              ><Redo2 :size="14" class="mr-1.5" /> {{ t('tools.crop.redo') }}</AppButton
            >
          </div>
          <button
            @click="handleReset"
            class="w-10 h-10 flex items-center justify-center hover:bg-destructive/10 rounded-xl text-muted-foreground/40 hover:text-destructive transition-all active:scale-90 border border-transparent hover:border-destructive/20"
            :title="t('tools.crop.resetAll')"
          >
            <RotateCcw :size="18" />
          </button>
        </div>
      </section>

      <AppExportSettings
        v-model:format="outputFormat"
        v-model:quality="outputQuality"
        v-model:preserve-exif="preserveExif"
        show-exif-option
        :title="t('common.export.title')"
        class="pt-2 pb-6 border-t border-border/40"
      />
    </template>

    <template #footer>
      <InspectorFooter class="bg-background/95 backdrop-blur-md border-t border-border/60">
        <AppButton
          size="lg"
          :variant="ctaState.action === 'download' ? 'success' : 'cta'"
          class="w-full h-12 rounded-xl shadow-lg transition-all duration-500 active:scale-95 group overflow-hidden"
          :loading="isProcessing"
          :disabled="ctaState.disabled"
          @click="handleCtaClick"
        >
          <template #icon>
            <component :is="ctaState.icon" v-if="!isProcessing" :size="18" class="mr-2" />
          </template>
          <span class="font-bold text-sm uppercase tracking-tight">{{ ctaState.text }}</span>
        </AppButton>
      </InspectorFooter>
    </template>

    <!-- 重置确认对话框 -->
    <AppModal
      :show="showResetConfirm"
      @close="showResetConfirm = false"
      :title="t('common.image.toolbar.confirmTitle')"
      variant="dialog"
    >
      <div class="p-6">
        <div class="flex items-start gap-4 mb-6">
          <div class="p-3 bg-destructive/10 rounded-2xl text-destructive shrink-0">
            <AlertCircle :size="24" />
          </div>
          <div>
            <h3 class="text-lg font-black text-foreground mb-1 tracking-tight">
              {{ t('common.image.toolbar.confirmReset') }}
            </h3>
            <p class="text-muted-foreground text-sm leading-relaxed font-medium">
              {{ t('common.image.toolbar.confirmResetToolTitle') }}
            </p>
            <p class="text-muted-foreground/60 text-[11px] mt-2 italic">
              {{ t('common.image.toolbar.confirmResetToolDesc') }}
            </p>
          </div>
        </div>
        <div class="flex gap-3">
          <AppButton
            variant="ghost"
            class="flex-1 rounded-xl h-11"
            @click="showResetConfirm = false"
          >
            {{ t('common.image.toolbar.cancel') }}
          </AppButton>
          <AppButton
            variant="danger"
            class="flex-1 rounded-xl h-11 shadow-lg shadow-destructive/10"
            @click="confirmReset"
          >
            {{ t('common.image.toolbar.confirm') }}
          </AppButton>
        </div>
      </div>
    </AppModal>
  </WorkspaceLayout>
</template>

<style scoped>
section {
  @apply transition-all duration-300;
}

/* 隐藏输入框上下箭头 */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type='number'] {
  -moz-appearance: textfield;
}
</style>
