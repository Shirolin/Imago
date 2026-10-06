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
import AppTip from '../components/common/AppTip.vue'
import { cropEngine } from '../lib/engines/cropEngine'
import {
  toPixelCoords,
  fromRotatedFrame,
  rotatedDims,
  clampCropPercent,
  isCropBoundsValid,
  type RotRect
} from '../lib/cropFrame'
import { useToolRun } from '../composables/useToolRun'
import { useResizeObserver, useDebounceFn } from '@vueuse/core'
import { useHistory } from '../composables/useHistory'
import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const { t } = useI18n()

// 监听图片列表变化：结果集清理交给 useToolRun，这里只管工具侧的复位
watch(
  () => store.images,
  (newImages) => {
    if (newImages.length === 0) {
      clearHistory()
      resetView()
    }
  },
  { deep: true }
)

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

/**
 * 坐标帧统一：CropBox 覆盖层的 internalCrop 是“未旋转原图局部帧”百分比（按原图 W×H），
 * 而 cropEngine 的裁剪坐标定义在“旋转/翻转后画布帧”（workCanvas，尺寸 rotatedWidth×rotatedHeight）。
 * 两者相差一次 90° 旋转（含镜像），不换算时旋转后输出区域与选区错位、比例锁定失效。
 *
 * 推导：引擎变换 p' = T(rotW/2, rotH/2) · R(θ) · S(sx, sy) · (p − (W/2, H/2))，
 * 对 90° 倍数每个输出轴只依赖一个输入轴，轴对齐框的映射可逐轴闭式求解。
 * 以旋转 90°（无翻转）为例：X = H − oy、Y = ox，故局部框 (px,py,pw,ph)
 * → 旋转帧 (H − py − ph, px, ph, pw)；180°：镜像 (W − px − pw, H − py − ph, pw, ph)；
 * 270°：(py, W − px − pw, ph, pw)。flipH/flipV（sx/sy ∈ {±1}）参与各轴符号。
 */
/**
 * 坐标帧变换已抽出到 lib/cropFrame。
 * 原为内联约 150 行（toRotatedFrame / fromRotatedFrame / rotDims /
 * cropBoundsValid / 护栏钳制），因 <script setup> 语法锁住而完全不可测；
 * 现由 40 条表驱动测试覆盖，含 6 种旋转 × 4 种翻转的往返一致性。
 */

/** 旋转后画布尺寸（引擎 workCanvas）：90°/270° 时宽高互换 */
const rotDims = computed(() =>
  rotatedDims(selectedImage.value?.width, selectedImage.value?.height, rotation.value)
)

// pxCoords 统一为“旋转帧像素坐标”（与引擎输出一致）：显示与数字输入均按 rotatedWidth/rotatedHeight
const pxCoords = computed<RotRect>({
  get: () => {
    const img = selectedImage.value
    if (!img || !img.width || !img.height) return { x: 0, y: 0, w: 0, h: 0 }
    return toPixelCoords(
      internalCrop.value,
      img.width,
      img.height,
      rotation.value,
      flipH.value,
      flipV.value
    )
  },
  set: (val) => {
    const img = selectedImage.value
    if (!img || !img.width || !img.height) return
    internalCrop.value = clampCropPercent(
      fromRotatedFrame(val, img.width, img.height, rotation.value, flipH.value, flipV.value)
    )
  }
})

/** 裁剪矩形是否落在旋转画布内（越界时 --danger 描边并禁用 CTA） */
const cropBoundsValid = computed(() =>
  isCropBoundsValid(pxCoords.value, rotDims.value.w, rotDims.value.h)
)
const handlePxInputChange = (key: 'x' | 'y' | 'w' | 'h', val: number | string) => {
  if (val === '' || val == null) return
  const num = typeof val === 'number' ? val : Number(val)
  if (Number.isNaN(num)) return
  // 输入框更新使用防抖提交
  recordDebounced()
  const newCoords = { ...pxCoords.value }
  newCoords[key] = num
  pxCoords.value = newCoords
}

// P2-6：trim 输入超界（>100 或 <0）时钳制到有效范围并给出可见提示，
// 避免引擎收到超界值静默产出 1px 垃圾结果（cropEngine 仅兜底 clamp 到 ≥1）
const trimWarning = ref('')
let trimWarningTimer: ReturnType<typeof setTimeout> | undefined
const handleTrimChange = (dir: keyof typeof trimPx.value, val: number | string) => {
  const raw = val === '' || val == null ? 0 : typeof val === 'number' ? val : Number(val)
  const clamped = Number.isFinite(raw) ? Math.min(100, Math.max(0, Math.round(raw))) : 0
  if (!Number.isFinite(raw) || raw > 100 || raw < 0) {
    trimWarning.value = t('tools.crop.trimLimitHint', { limit: 100 })
    if (trimWarningTimer) clearTimeout(trimWarningTimer)
    trimWarningTimer = setTimeout(() => (trimWarning.value = ''), 2600)
  }
  trimPx.value = { ...trimPx.value, [dir]: clamped }
}

const onCropChange = (data: {
  x: number
  y: number
  w: number
  h: number
  isDragging: boolean
  isSnapping: boolean
}) => {
  // P2-2：拖拽开始已在 pointerdown（dragStart）时提前记录快照，
  // 这里仅在拖拽结束事件上报最终状态时提交一次历史
  if (!data.isDragging && isDragging.value) {
    recordImmediate() // 记录动作后的最终状态
  }
  isDragging.value = data.isDragging
  isSnapping.value = data.isSnapping
}

// P2-2：pointerdown 即记录拖拽前的原始状态（早于任何位移）
const handleDragStart = () => {
  recordImmediate()
}

// P2-1：双击重置走历史记录，可撤销
const handleCropBoxReset = () => {
  recordImmediate()
  internalCrop.value = { x: 0, y: 0, w: 100, h: 100 }
}

useResizeObserver(containerRef, resetView)
// 确认框状态
const showResetConfirm = ref(false)

/** 复位全部裁剪状态（不清结果 Map 中其他图片的产物） */
const resetAllState = () => {
  rotation.value = 0
  flipH.value = false
  flipV.value = false
  currentRatio.value = 0
  internalCrop.value = { x: 0, y: 0, w: 100, h: 100 }
  trimPx.value = { top: 0, bottom: 0, left: 0, right: 0 }
  fillColor.value = 'transparent'

  if (store.activeId) {
    reset(store.activeId)
  }

  clearHistory()
  resetView()
}

const handleReset = () => {
  // 仅用户主动点击“重置”才弹确认框
  showResetConfirm.value = true
}

const confirmReset = () => {
  resetAllState()
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
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (trimWarningTimer) clearTimeout(trimWarningTimer)
})

// 【核心优化】：图片切换时强制重置所有参数，确保状态隔离。
// 切换/进入视图属于隐式操作，直接复位不弹确认框（弹窗仅保留用户主动点击“重置”）。
watch(
  () => store.activeId,
  (newId) => {
    if (!newId) return
    resetAllState()
  },
  { immediate: true }
)

/**
 * 处理 → 结果 → 导出交给 useToolRun。
 *
 * scope: 'active' —— 裁剪一次只作用于当前聚焦的一张。
 * blocked 用 cropBoundsValid 挡住 X/Y/W/H 越界，此前是 CTA 状态机里的一个分支。
 * onEmpty 承接「图片清空后清历史 + 复位视图」，属工具语义。
 */
const toolRun = useToolRun({
  id: 'crop',
  scope: 'active',
  processor: cropEngine,
  blocked: () => !cropBoundsValid.value,
  options: () => {
    const coords = pxCoords.value
    return {
      x: coords.x,
      y: coords.y,
      width: coords.w,
      height: coords.h,
      usePercentage: false,
      rotation: rotation.value,
      flipH: flipH.value,
      flipV: flipV.value,
      fillColor: fillColor.value,
      trimPx: trimPx.value,
      format: outputFormat.value === 'original' ? undefined : outputFormat.value,
      quality: outputQuality.value,
      preserveExif: preserveExif.value
    }
  },
  onEmpty: () => {
    clearHistory()
    resetView()
  }
})

const { cta, act: run, reset } = toolRun
const isProcessing = toolRun.isRunning

const cleanupResults = () => reset()

const ctaCopy = computed(() => {
  switch (cta.value.action) {
    case 'select':
      return { text: t('tools.crop.cta.select'), icon: Scissors }
    case 'export':
      return { text: t('tools.crop.cta.export', { count: 1 }), icon: Download }
    case 'abort':
      return { text: t('common.processing'), icon: Scissors }
    default:
      return { text: t('tools.crop.cta.apply', { count: 1 }), icon: Scissors }
  }
})

const handleCtaClick = async () => {
  await run()
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
        @reset-all="cleanupResults"
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
              @drag-start="handleDragStart"
              @drag-end="recordImmediate"
              @reset="handleCropBoxReset"
            />
          </div>
        </template>

        <template #floating>
          <div
            class="absolute imago-canvas-hud left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-3 z-40 transition-opacity duration-300"
            :class="isDragging ? 'opacity-100' : 'opacity-0'"
          >
            <div
              v-if="isSnapping"
              class="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-[11px] font-medium"
            >
              {{ t('tools.crop.snapped') }}
            </div>

            <div class="flex flex-col items-center gap-1.5">
              <div
                class="px-4 py-2 bg-[var(--board)] text-foreground rounded-xl border border-[var(--hairline)] text-xs font-mono font-medium tabular-nums"
              >
                {{ pxCoords.w }} × {{ pxCoords.h }} PX
              </div>

              <!-- 下沉式功能提示：在这里显示双击重置，不遮挡拉手 -->
              <div
                class="px-2.5 py-1 bg-[var(--board)] rounded-lg border border-[var(--hairline)] text-[11px] text-muted-foreground/60 font-medium flex items-center gap-1.5"
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
        <div class="grid grid-cols-3 gap-2">
          <button
            @click="handleRotate"
            class="flex flex-col items-center gap-2 p-3 rounded-xl border bg-background/50 hover:bg-primary/5 hover:border-primary/30 transition-all group"
            :title="t('tools.crop.rotateTip')"
            :aria-label="t('tools.crop.rotate')"
          >
            <RotateCw
              :size="18"
              class="text-muted-foreground group-hover:text-primary transition-colors"
            /><span class="text-[11px] font-medium text-muted-foreground">{{
              t('tools.crop.rotate')
            }}</span>
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
            :aria-label="t('tools.crop.flipH')"
          >
            <FlipHorizontal :size="18" class="group-hover:text-primary transition-colors" /><span
              class="text-[11px] font-medium"
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
            :aria-label="t('tools.crop.flipV')"
          >
            <FlipVertical :size="18" class="group-hover:text-primary transition-colors" /><span
              class="text-[11px] font-medium"
              >{{ t('tools.crop.flipV') }}</span
            >
          </button>
        </div>
      </section>
      <section class="space-y-4 pt-6 border-t border-[var(--hairline)]">
        <AppSectionHeader :title="t('tools.crop.aspectRatio')" :icon="Scissors" />
        <div class="space-y-4">
          <AppButton
            variant="secondary"
            fill
            class="w-full min-h-10 h-auto rounded-xl bg-background/50 border-dashed border-border hover:border-primary/50 hover:bg-primary/[0.02] group transition-all"
            @click="handleFillImage"
            :aria-label="t('tools.crop.fillAll')"
          >
            <template #icon>
              <Maximize2
                :size="16"
                class="mr-2 text-muted-foreground group-hover:text-primary transition-colors"
              />
            </template>
            {{ t('tools.crop.fillAll') }}
          </AppButton>

          <AppSegmentedControl
            v-model="currentRatio"
            :options="ratios"
            @update:model-value="handleRatioChange"
          />
          <div class="space-y-3 pt-1">
            <div class="flex items-center justify-between ml-1">
              <span class="text-[11px] font-medium text-muted-foreground">{{
                t('tools.crop.gridLines')
              }}</span>
              <span class="text-[9px] text-muted-foreground/40 italic">{{
                t('tools.crop.gridLinesTip')
              }}</span>
            </div>
            <AppSegmentedControl
              v-model="gridMode"
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
      <section class="space-y-4 pt-6 border-t border-[var(--hairline)]">
        <AppSectionHeader :title="t('tools.crop.precision')" :icon="LayoutGrid" />
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-x-3 gap-y-4 relative">
            <div class="space-y-1.5">
              <label class="text-[11px] font-medium text-muted-foreground ml-1">{{
                t('tools.crop.posX')
              }}</label>
              <AppInput
                type="number"
                :model-value="Math.round(pxCoords.x)"
                :min="0"
                :max="Math.max(0, rotDims.w - pxCoords.w)"
                @update:model-value="handlePxInputChange('x', $event)"
                class="h-10 text-xs font-mono transition-all"
                :class="[
                  pxCoords.x < 0 || pxCoords.x + pxCoords.w > rotDims.w
                    ? 'border-[var(--danger)] ring-1 ring-[color-mix(in_srgb,var(--danger)_15%,transparent)]'
                    : 'bg-background/50'
                ]"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-[11px] font-medium text-muted-foreground ml-1">{{
                t('tools.crop.posY')
              }}</label>
              <AppInput
                type="number"
                :model-value="Math.round(pxCoords.y)"
                :min="0"
                :max="Math.max(0, rotDims.h - pxCoords.h)"
                @update:model-value="handlePxInputChange('y', $event)"
                class="h-10 text-xs font-mono transition-all"
                :class="[
                  pxCoords.y < 0 || pxCoords.y + pxCoords.h > rotDims.h
                    ? 'border-[var(--danger)] ring-1 ring-[color-mix(in_srgb,var(--danger)_15%,transparent)]'
                    : 'bg-background/50'
                ]"
              />
            </div>

            <div class="col-span-2 grid grid-cols-2 gap-x-3 relative mt-1">
              <div class="space-y-1.5">
                <label
                  class="text-[11px] font-medium ml-1 transition-colors"
                  :class="currentRatio > 0 ? 'text-primary' : 'text-muted-foreground'"
                  >{{ t('tools.crop.width') }}</label
                >
                <AppInput
                  type="number"
                  :model-value="Math.round(pxCoords.w)"
                  :min="1"
                  :max="Math.max(1, rotDims.w - pxCoords.x)"
                  @update:model-value="handlePxInputChange('w', $event)"
                  class="h-10 text-xs font-mono transition-all"
                  :class="[
                    currentRatio > 0
                      ? 'border-primary/40 bg-primary/[0.03] ring-1 ring-primary/10'
                      : 'border-border bg-background/50',
                    pxCoords.w < 1 || pxCoords.x + pxCoords.w > rotDims.w
                      ? 'border-[var(--danger)] ring-1 ring-[color-mix(in_srgb,var(--danger)_15%,transparent)]'
                      : ''
                  ]"
                />
              </div>

              <div
                class="absolute left-1/2 top-[2.1rem] -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center"
              >
                <div
                  class="bg-background border rounded-full p-1 shadow-sm transition-colors"
                  :class="
                    currentRatio > 0
                      ? 'border-primary/40 text-primary rotate-0'
                      : 'border-border text-muted-foreground/40 rotate-[-45deg]'
                  "
                >
                  <component :is="currentRatio > 0 ? LinkIcon : Unlink" :size="12" />
                </div>
              </div>

              <div class="space-y-1.5">
                <label
                  class="text-[11px] font-medium ml-1 transition-colors"
                  :class="currentRatio > 0 ? 'text-primary' : 'text-muted-foreground'"
                  >{{ t('tools.crop.height') }}</label
                >
                <AppInput
                  type="number"
                  :model-value="Math.round(pxCoords.h)"
                  :min="1"
                  :max="Math.max(1, rotDims.h - pxCoords.y)"
                  @update:model-value="handlePxInputChange('h', $event)"
                  class="h-10 text-xs font-mono transition-all"
                  :class="[
                    currentRatio > 0
                      ? 'border-primary/40 bg-primary/[0.03] ring-1 ring-primary/10'
                      : 'border-border bg-background/50',
                    pxCoords.h < 1 || pxCoords.y + pxCoords.h > rotDims.h
                      ? 'border-[var(--danger)] ring-1 ring-[color-mix(in_srgb,var(--danger)_15%,transparent)]'
                      : ''
                  ]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 第四分区：画布外观 (环境配置) -->
      <section class="space-y-4 pt-6 border-t border-[var(--hairline)]">
        <AppSectionHeader :title="t('tools.crop.canvasAppearance')" :icon="Settings2" />
        <AppColorPicker v-model="fillColor" :label="t('tools.crop.bgFill')" />
      </section>

      <!-- 第五分区：边缘精修 (TRIM) - 后处理阶段 -->
      <section class="space-y-4 pt-6 border-t border-[var(--hairline)]">
        <AppSectionHeader :title="t('tools.crop.edgeTrim')" :icon="Settings2" />
        <AppTip>{{ t('tools.crop.trimWarning') }}</AppTip>
        <div class="grid grid-cols-2 gap-3">
          <div v-for="dir in ['top', 'bottom', 'left', 'right']" :key="dir" class="space-y-2">
            <label class="text-[11px] font-medium text-muted-foreground ml-1">{{
              t('tools.crop.trim' + dir.charAt(0).toUpperCase() + dir.slice(1))
            }}</label>
            <AppInput
              type="number"
              :model-value="trimPx[dir as keyof typeof trimPx]"
              @update:model-value="handleTrimChange(dir as keyof typeof trimPx, $event)"
              :min="0"
              :max="100"
            />
          </div>
        </div>
        <div
          v-if="trimWarning"
          class="flex items-start gap-2 text-[10px] font-medium text-[var(--danger)]"
          role="status"
        >
          <AlertCircle :size="12" class="shrink-0 mt-0.5" />
          <span>{{ trimWarning }}</span>
        </div>
      </section>

      <!-- 第六分区：操作管理 (终结阶段) -->
      <section class="space-y-4 pt-6 border-t border-[var(--hairline)] pb-4">
        <AppSectionHeader :title="t('tools.crop.history')" :icon="History" />
        <div class="flex items-center justify-between gap-3">
          <div class="flex-1 grid grid-cols-2 gap-2">
            <AppButton
              variant="secondary"
              size="sm"
              fill
              :disabled="!canUndo"
              @click="undo"
              class="w-full rounded-xl min-h-10 h-auto text-[11px] font-medium bg-background/50 border-[var(--hairline)] hover:bg-primary/[0.02]"
              :aria-label="t('tools.crop.undo')"
            >
              <template #icon><Undo2 :size="14" class="mr-1.5" /></template>
              {{ t('tools.crop.undo') }}
            </AppButton>
            <AppButton
              variant="secondary"
              size="sm"
              fill
              :disabled="!canRedo"
              @click="redo"
              class="w-full rounded-xl min-h-10 h-auto text-[11px] font-medium bg-background/50 border-[var(--hairline)] hover:bg-primary/[0.02]"
              :aria-label="t('tools.crop.redo')"
            >
              <template #icon><Redo2 :size="14" class="mr-1.5" /></template>
              {{ t('tools.crop.redo') }}
            </AppButton>
          </div>
          <button
            @click="handleReset"
            class="w-10 h-10 flex items-center justify-center hover:bg-destructive/10 rounded-xl text-muted-foreground/40 hover:text-destructive transition-colors border border-transparent hover:border-destructive/20"
            :title="t('tools.crop.resetAll')"
            :aria-label="t('tools.crop.resetAll')"
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
        canvas-only
        :title="t('common.export.title')"
        class="pt-2 pb-6 border-t border-[var(--hairline)]"
      />
    </template>

    <template #footer>
      <InspectorFooter
        class="bg-[var(--chrome)] border-t border-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
      >
        <AppButton
          size="lg"
          fill
          :variant="cta.action === 'export' ? 'success' : 'cta'"
          class="w-full rounded-xl transition-colors"
          :loading="isProcessing"
          :disabled="cta.disabled"
          @click="handleCtaClick"
        >
          <template #icon>
            <component :is="ctaCopy.icon" v-if="!isProcessing" :size="18" class="mr-2" />
          </template>
          {{ ctaCopy.text }}
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
            <h3 class="text-lg font-medium text-foreground mb-1">
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
          <AppButton variant="danger" class="flex-1 rounded-xl h-11" @click="confirmReset">
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
