<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, h } from 'vue'
import { useImageStore } from '../stores/imageStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import CropBox from '../components/common/CropBox.vue'
import {
  Scissors,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Type,
  RefreshCw,
  Maximize2,
  Minimize2,
  Trash2,
  Grid3X3,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grip,
  Square,
  MousePointer2,
  RotateCcw,
  Undo2,
  Redo2,
  History
} from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppSelect from '../components/common/AppSelect.vue'
import { cropEngine } from '../lib/engines/cropEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useResizeObserver, useElementBounding } from '@vueuse/core'
import { useHistory } from '../composables/useHistory'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()

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

// --- 状态汇总 ---
const rotation = ref(0)
const flipH = ref(false)
const flipV = ref(false)
const currentRatio = ref<number>(0)
const outputQuality = ref(0.92)
const outputFormat = ref<string>('original')
const preserveExif = ref(false)
const customFillColor = ref('#ffffff')
const isTransparent = ref(true)
const internalCrop = ref({ x: 0, y: 0, w: 100, h: 100 })
const gridMode = ref<'none' | 'thirds' | 'golden' | 'cross'>('thirds')
const trimPx = ref({ top: 0, bottom: 0, left: 0, right: 0 })

// 组合设置快照
const allSettings = computed({
  get: () => ({
    rotation: rotation.value,
    flipH: flipH.value,
    flipV: flipV.value,
    currentRatio: currentRatio.value,
    outputQuality: outputQuality.value,
    outputFormat: outputFormat.value,
    preserveExif: preserveExif.value,
    customFillColor: customFillColor.value,
    isTransparent: isTransparent.value,
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
    customFillColor.value = v.customFillColor
    isTransparent.value = v.isTransparent
    internalCrop.value = { ...v.internalCrop }
    gridMode.value = v.gridMode
    trimPx.value = { ...v.trimPx }
  }
})

const { canUndo, canRedo, undo, redo, commit, clear: clearHistory } = useHistory(allSettings)

// 动作点记录：必须在“修改之前”调用，记录旧状态
const recordBeforeAction = () => commit()

const handleRotate = () => {
  recordBeforeAction()
  rotation.value = (rotation.value + 90) % 360
}
const handleFlipH = () => {
  recordBeforeAction()
  flipH.value = !flipH.value
}
const handleFlipV = () => {
  recordBeforeAction()
  flipV.value = !flipV.value
}
const handleRatioChange = (val: any) => {
  recordBeforeAction()
  currentRatio.value = val
}
const handleTransparentToggle = () => {
  recordBeforeAction()
  isTransparent.value = !isTransparent.value
}
const handleColorChange = () => {
  recordBeforeAction()
}
const handleSliderChange = () => {
  recordBeforeAction()
}

const finalFillColor = computed(() => (isTransparent.value ? 'transparent' : customFillColor.value))
const isDragging = ref(false)
const isSnapping = ref(false)

const { isProcessing, processSingle } = useImageProcessor(cropEngine)
const selectedImage = computed(() => store.activeImage)
const pixelSize = computed(() => {
  const img = selectedImage.value
  if (!img || !img.width || !img.height) return { w: 0, h: 0 }
  return {
    w: Math.round((internalCrop.value.w / 100) * img.width),
    h: Math.round((internalCrop.value.h / 100) * img.height)
  }
})

const containerRef = ref<HTMLDivElement | null>(null)
const scale = ref(1)
const offset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const startPanPos = ref({ x: 0, y: 0 })
const { width: cw, height: ch, left: cl, top: ct } = useElementBounding(containerRef)

const resetView = () => {
  const container = containerRef.value
  const img = selectedImage.value
  if (!container || !img || !img.width) return
  const availableW = container.clientWidth - 120
  const availableH = container.clientHeight - 120
  scale.value = Math.min(availableW / img.width, availableH / img.height!, 1)
  offset.value = { x: 0, y: 0 }
}
const zoomIn = () => {
  scale.value *= 1.2
}
const zoomOut = () => {
  scale.value *= 0.8
}
const setZoom100 = () => {
  scale.value = 1
  offset.value = { x: 0, y: 0 }
}

const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const zoomStep = 1.15
    const delta = e.deltaY > 0 ? 1 / zoomStep : zoomStep
    const newScale = Math.max(0.01, Math.min(scale.value * delta, 20))
    const mouseX = e.clientX - cl.value - cw.value / 2
    const mouseY = e.clientY - ct.value - ch.value / 2
    offset.value = {
      x: mouseX - (mouseX - offset.value.x) * (newScale / scale.value),
      y: mouseY - (mouseY - offset.value.y) * (newScale / scale.value)
    }
    scale.value = newScale
  }
}
const handlePointerDown = (e: PointerEvent) => {
  if (e.button === 1 || e.altKey) {
    isPanning.value = true
    startPanPos.value = { x: e.clientX - offset.value.x, y: e.clientY - offset.value.y }
    containerRef.value?.setPointerCapture(e.pointerId)
  }
}
const handlePointerMove = (e: PointerEvent) => {
  if (isPanning.value)
    offset.value = { x: e.clientX - startPanPos.value.x, y: e.clientY - startPanPos.value.y }
}
const handlePointerUp = () => {
  isPanning.value = false
}

const onCropChange = (data: any) => {
  if (data.isDragging && !isDragging.value) {
    // 关键：拖拽开始的瞬间记录旧位置
    recordBeforeAction()
  }
  isDragging.value = data.isDragging
  isSnapping.value = data.isSnapping
}

useResizeObserver(containerRef, resetView)
const handleReset = () => {
  recordBeforeAction()
  rotation.value = 0
  flipH.value = false
  flipV.value = false
  currentRatio.value = 0
  internalCrop.value = { x: 0, y: 0, w: 100, h: 100 }
  trimPx.value = { top: 0, bottom: 0, left: 0, right: 0 }
  isTransparent.value = true
  resetView()
}

watch(
  () => store.activeId,
  async (id) => {
    if (id) {
      clearHistory() // 切换图片，彻底清空历史栈
      await nextTick()
      resetView()
    }
  },
  { immediate: true }
)

const handleProcess = async () => {
  const img = selectedImage.value
  if (!img) return
  await processSingle(img.id, {
    x: internalCrop.value.x,
    y: internalCrop.value.y,
    width: internalCrop.value.w,
    height: internalCrop.value.h,
    usePercentage: true,
    rotation: rotation.value,
    flipH: flipH.value,
    flipV: flipV.value,
    fillColor: finalFillColor.value,
    trimPx: trimPx.value,
    format: outputFormat.value === 'original' ? undefined : outputFormat.value,
    quality: outputQuality.value,
    preserveExif: preserveExif.value
  })
}

const ratios = [
  { label: '自由', value: 0, icon: Scissors },
  { label: '1:1', value: 1, icon: Square },
  { label: '4:3', value: 4 / 3, icon: Icon43 },
  { label: '16:9', value: 16 / 9, icon: Icon169 },
  { label: '2:3', value: 2 / 3, icon: Icon23 }
]
const formatOptions = [
  { label: '保留原格式', value: 'original' },
  { label: 'WebP (推荐)', value: 'image/webp' },
  { label: 'JPEG (高兼容)', value: 'image/jpeg' },
  { label: 'PNG (无损)', value: 'image/png' }
]
const buttonText = computed(() => (isProcessing.value ? '正在处理...' : '裁剪并保存'))
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
    <template #header-left><ImageSelectionStatus /></template>
    <template #header-actions
      ><ImageActionsToolbar :is-processing="isProcessing" show-clear-all
    /></template>

    <template #content>
      <div class="h-full flex flex-col p-4 md:p-6 overflow-hidden w-full relative">
        <div
          ref="containerRef"
          class="flex-1 bg-muted/10 border border-border/40 rounded-3xl overflow-hidden relative group select-none touch-none"
          :class="{ 'cursor-grabbing': isPanning }"
          @wheel="handleWheel"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
        >
          <div class="absolute inset-0 transparency-grid opacity-40"></div>
          <div
            class="absolute inset-0 flex items-center justify-center"
            :style="{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }"
          >
            <div v-if="selectedImage" class="relative z-10">
              <CropBox
                :image-url="selectedImage.preview"
                :aspect-ratio="currentRatio"
                v-model="internalCrop"
                :grid-mode="gridMode"
                :fill-color="finalFillColor"
                :scale="scale"
                @change="onCropChange"
              />
            </div>
          </div>
          <div
            class="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-4 transition-all duration-300 z-40"
            :class="{
              'opacity-100 translate-y-0': isDragging,
              'opacity-0 translate-y-4': !isDragging
            }"
          >
            <div
              v-if="isSnapping"
              class="px-4 py-2 bg-black/80 backdrop-blur-xl rounded-full border border-primary text-primary flex items-center gap-3 shadow-2xl transition-all"
            >
              <div class="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
              <span class="text-[0.7rem] font-bold tracking-widest uppercase"
                >已吸附边缘 (Alt取消)</span
              >
            </div>
            <div
              class="px-4 py-2 bg-black/80 backdrop-blur-xl rounded-full border border-white/10 text-[0.7rem] text-white font-mono font-bold shadow-2xl"
            >
              {{ pixelSize.w }} × {{ pixelSize.h }} PX
            </div>
          </div>
          <div
            class="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1.5 bg-background/80 backdrop-blur-2xl border border-border/60 rounded-2xl shadow-elevated"
          >
            <button
              @click="zoomOut"
              class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted"
            >
              <ZoomOut :size="18" />
            </button>
            <div class="px-2 min-w-[50px] text-center font-mono text-xs font-black">
              {{ Math.round(scale * 100) }}%
            </div>
            <button
              @click="zoomIn"
              class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted"
            >
              <ZoomIn :size="18" />
            </button>
            <div class="w-px h-4 bg-border/20 mx-1"></div>
            <button
              @click="setZoom100"
              class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted text-[10px] font-black uppercase"
            >
              1:1
            </button>
            <button
              @click="resetView"
              class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-primary/10 text-primary"
              title="适应屏幕"
            >
              <Maximize :size="18" />
            </button>
          </div>
          <div
            class="absolute top-6 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-black/40 backdrop-blur-md border border-white/5 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center gap-4"
          >
            <span
              class="text-[0.65rem] text-white/90 font-black uppercase tracking-[0.2em] flex items-center gap-2"
              ><Grip :size="14" class="text-primary" /> Ctrl+滚轮缩放 • Alt+平移</span
            >
          </div>
        </div>
      </div>
    </template>

    <template #sidebar>
      <section class="space-y-5">
        <AppSectionHeader title="裁剪比例" :icon="Scissors" />
        <div class="space-y-4 px-1">
          <AppSegmentedControl
            v-model="currentRatio"
            :options="ratios"
            @update:model-value="handleRatioChange"
          />
          <AppSegmentedControl
            v-model="gridMode"
            :options="[
              { label: '无参考', value: 'none', icon: Maximize2 },
              { label: '三分法', value: 'thirds', icon: Grid3X3 }
            ]"
          />
        </div>
      </section>

      <section class="space-y-5">
        <div class="flex items-center justify-between pr-1">
          <AppSectionHeader title="变换与历史" :icon="History" />
          <button
            @click="handleReset"
            title="重置当前设置"
            class="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground/60 hover:text-primary active:scale-90"
          >
            <RotateCcw :size="16" />
          </button>
        </div>

        <div class="px-1 space-y-4">
          <div class="grid grid-cols-2 gap-2">
            <button
              @click="undo"
              :disabled="!canUndo"
              class="flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all font-bold text-[11px] uppercase tracking-wider"
              :class="
                canUndo
                  ? 'bg-background border-border text-foreground hover:border-primary/40 hover:bg-primary/5 active:scale-95'
                  : 'bg-muted/30 border-border/20 text-muted-foreground/30 cursor-not-allowed'
              "
            >
              <Undo2 :size="14" /> 撤销
            </button>
            <button
              @click="redo"
              :disabled="!canRedo"
              class="flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all font-bold text-[11px] uppercase tracking-wider"
              :class="
                canRedo
                  ? 'bg-background border-border text-foreground hover:border-primary/40 hover:bg-primary/5 active:scale-95'
                  : 'bg-muted/30 border-border/20 text-muted-foreground/30 cursor-not-allowed'
              "
            >
              <Redo2 :size="14" /> 重做
            </button>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <button
              @click="handleRotate"
              class="flex flex-col items-center gap-2 p-3 rounded-2xl bg-muted/20 border border-border/40 hover:bg-primary/5 transition-all group"
            >
              <RotateCw :size="18" class="text-muted-foreground group-hover:text-primary" /><span
                class="text-[10px] font-bold text-muted-foreground uppercase"
                >旋转</span
              >
            </button>
            <button
              @click="handleFlipH"
              class="flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all"
              :class="
                flipH
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-muted/20 border-border/40 text-muted-foreground'
              "
            >
              <FlipHorizontal :size="18" /><span class="text-[10px] font-bold uppercase">水平</span>
            </button>
            <button
              @click="handleFlipV"
              class="flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all"
              :class="
                flipV
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-muted/20 border-border/40 text-muted-foreground'
              "
            >
              <FlipVertical :size="18" /><span class="text-[10px] font-bold uppercase">垂直</span>
            </button>
          </div>
        </div>
      </section>

      <section class="space-y-5">
        <AppSectionHeader title="扩图填充" :icon="Type" />
        <div class="space-y-6 px-1">
          <div
            class="bg-muted/10 rounded-2xl p-4 border border-border/60 flex items-center justify-between"
          >
            <label class="text-[10px] font-black text-muted-foreground uppercase tracking-widest"
              >背景色</label
            >
            <div class="flex items-center gap-3">
              <button
                @click="handleTransparentToggle"
                class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all"
                :class="
                  isTransparent
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-muted/20 border-border text-muted-foreground'
                "
              >
                透明
              </button>
              <input
                type="color"
                v-model="customFillColor"
                @mousedown="handleColorChange"
                class="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                :disabled="isTransparent"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <AppSlider
              v-model="trimPx.top"
              label="上"
              :min="0"
              :max="200"
              unit="px"
              @mousedown="handleSliderChange"
            />
            <AppSlider
              v-model="trimPx.bottom"
              label="下"
              :min="0"
              :max="200"
              unit="px"
              @mousedown="handleSliderChange"
            />
            <AppSlider
              v-model="trimPx.left"
              label="左"
              :min="0"
              :max="200"
              unit="px"
              @mousedown="handleSliderChange"
            />
            <AppSlider
              v-model="trimPx.right"
              label="右"
              :min="0"
              :max="200"
              unit="px"
              @mousedown="handleSliderChange"
            />
          </div>
        </div>
      </section>

      <section class="space-y-5 pb-4">
        <AppSectionHeader title="保存配置" :icon="RefreshCw" />
        <div class="space-y-4 px-1">
          <AppSelect v-model="outputFormat" :options="formatOptions" />
          <AppSlider
            v-if="outputFormat !== 'original' && outputFormat !== 'image/png'"
            v-model="outputQuality"
            label="质量"
            :min="0.1"
            :max="1.0"
            :step="0.05"
          />
        </div>
      </section>
    </template>

    <template #footer>
      <InspectorFooter>
        <AppButton
          variant="cta"
          class="w-full h-12 rounded-xl shadow-xl shadow-primary/10 transition-all active:scale-95"
          :loading="isProcessing"
          @click="handleProcess"
        >
          <template #icon><Scissors v-if="!isProcessing" :size="18" class="mr-2" /></template>
          <span class="font-bold text-sm tracking-tight">{{ buttonText }}</span>
        </AppButton>
      </InspectorFooter>
    </template>
  </WorkspaceLayout>
</template>

<style scoped>
.transparency-grid {
  background-image: conic-gradient(
    hsl(var(--muted-foreground) / 0.07) 0 25%,
    transparent 0 50%,
    hsl(var(--muted-foreground) / 0.07) 0 75%,
    transparent 0
  );
  background-size: 16px 16px;
}
.animate-spin-slow {
  animation: spin 3s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
