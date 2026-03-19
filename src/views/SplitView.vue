<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppSelect from '../components/common/AppSelect.vue'
import {
  Scissors,
  Grid3X3,
  Layers,
  FileType,
  Box,
  AlignCenter,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grip,
  Keyboard,
  MousePointerSquareDashed,
  Trash2
} from 'lucide-vue-next'
import { splitEngine } from '../lib/engines/splitEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useResizeObserver, useElementBounding } from '@vueuse/core'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const { downloadImage } = useFileHelpers()

// 状态
const rows = ref(3)
const cols = ref(3)
const centerMode = ref<'none' | 'center' | 'square'>('none')
const shave = ref(0)
const outputFormat = ref<string>('original')
const outputQuality = ref(0.9)

const { isProcessing, processSingle } = useImageProcessor(splitEngine)
const selectedImage = computed(() => store.activeImage)

// 画布交互逻辑
const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const scale = ref(1)
const offset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const startPanPos = ref({ x: 0, y: 0 })

const editMode = ref<'grid' | 'custom'>('grid')
const activeAxis = ref<'x' | 'y'>('x')
const draggingLine = ref<{ axis: 'x' | 'y'; index: number } | null>(null)
const hoveredLine = ref<{ axis: 'x' | 'y'; index: number } | null>(null)
const isSnapping = ref(false)
const mousePos = ref({ x: 0, y: 0 })
const magnifierPos = ref({ x: 0, y: 0 })
const isAltPressed = ref(false)

const linesX = ref<number[]>([])
const linesY = ref<number[]>([])

let cachedCanvasRect: DOMRect | null = null
const updateCanvasRect = () => {
  if (canvasRef.value) cachedCanvasRect = canvasRef.value.getBoundingClientRect()
}

let offscreenCanvas: HTMLCanvasElement | null = null
let isDrawingRaf = false

const updateCachedImage = () => {
  const imgData = selectedImage.value
  if (!imgData) {
    offscreenCanvas = null
    return
  }
  const img = new Image()
  img.src = imgData.preview
  img.onload = () => {
    offscreenCanvas = document.createElement('canvas')
    offscreenCanvas.width = imgData.width!
    offscreenCanvas.height = imgData.height!
    const octx = offscreenCanvas.getContext('2d')
    octx?.drawImage(img, 0, 0)
    requestDraw()
  }
}

const draw = () => {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  const img = selectedImage.value
  if (!canvas || !ctx || !offscreenCanvas || !img) return
  canvas.width = img.width!
  canvas.height = img.height!
  ctx.clearRect(0, 0, img.width!, img.height!)
  ctx.drawImage(offscreenCanvas, 0, 0)

  const drawStylizedLine = (
    pos: number,
    isVertical: boolean,
    isHovered: boolean,
    isPreview: boolean = false
  ) => {
    ctx.save()
    const colorPrimary = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary')
      .trim()
    const colorMuted = getComputedStyle(document.documentElement)
      .getPropertyValue('--muted-foreground')
      .trim()
    const activeColor =
      isAltPressed.value && isPreview ? `hsl(${colorMuted})` : `hsl(${colorPrimary})`
    ctx.beginPath()
    ctx.lineWidth = (isPreview ? 1 : 2) / scale.value
    ctx.strokeStyle = isPreview ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.3)'
    if (isVertical) {
      ctx.moveTo(pos + 1 / scale.value, 0)
      ctx.lineTo(pos + 1 / scale.value, img.height!)
    } else {
      ctx.moveTo(0, pos + 1 / scale.value)
      ctx.lineTo(img.width!, pos + 1 / scale.value)
    }
    ctx.stroke()
    ctx.beginPath()
    if (isPreview) ctx.setLineDash([5, 5])
    ctx.lineWidth = (isHovered ? 3 : 1.5) / scale.value
    ctx.strokeStyle = isPreview ? 'rgba(255,255,255,0.7)' : activeColor
    if (isVertical) {
      ctx.moveTo(pos, 0)
      ctx.lineTo(pos, img.height!)
    } else {
      ctx.moveTo(0, pos)
      ctx.lineTo(img.width!, pos)
    }
    if (isHovered && !isPreview) {
      ctx.shadowBlur = 10 / scale.value
      ctx.shadowColor = activeColor
    }
    ctx.stroke()
    ctx.restore()
  }
  linesX.value.forEach((lx, i) =>
    drawStylizedLine(lx, true, hoveredLine.value?.axis === 'x' && hoveredLine.value.index === i)
  )
  linesY.value.forEach((ly, i) =>
    drawStylizedLine(ly, false, hoveredLine.value?.axis === 'y' && hoveredLine.value.index === i)
  )
}

const requestDraw = () => {
  if (!isDrawingRaf) {
    isDrawingRaf = true
    requestAnimationFrame(() => {
      draw()
      isDrawingRaf = false
    })
  }
}

const {
  width: containerWidth,
  height: containerHeight,
  left: containerLeft,
  top: containerTop
} = useElementBounding(containerRef)

const resetView = () => {
  const container = containerRef.value
  const img = selectedImage.value
  if (!container || !img) return
  scale.value = Math.min(
    (container.clientWidth - 80) / img.width!,
    (container.clientHeight - 80) / img.height!,
    1
  )
  offset.value = { x: 0, y: 0 }
  setTimeout(updateCanvasRect, 100)
}

const saveMeta = () => {
  if (selectedImage.value)
    store.updateImage(selectedImage.value.id, {
      splitMeta: {
        linesX: [...linesX.value],
        linesY: [...linesY.value],
        editMode: editMode.value,
        rows: rows.value,
        cols: cols.value
      }
    })
}

watch(() => selectedImage.value?.id, updateCachedImage, { immediate: true })
watch(
  () => selectedImage.value?.id,
  (newId) => {
    if (!newId) return
    const img = selectedImage.value
    if (img?.splitMeta) {
      const m = img.splitMeta
      editMode.value = m.editMode
      rows.value = m.rows
      cols.value = m.cols
      linesX.value = [...m.linesX]
      linesY.value = [...m.linesY]
    }
    nextTick(resetView)
  },
  { immediate: true }
)

const getLogicPos = (e: PointerEvent) => {
  if (!cachedCanvasRect) updateCanvasRect()
  const rect = cachedCanvasRect!
  return { x: (e.clientX - rect.left) / scale.value, y: (e.clientY - rect.top) / scale.value }
}

const handlePointerDown = (e: PointerEvent) => {
  if (!containerRef.value) return
  updateCanvasRect()
  if (e.button === 1 || e.shiftKey) {
    isPanning.value = true
    startPanPos.value = { x: e.clientX - offset.value.x, y: e.clientY - offset.value.y }
    containerRef.value.setPointerCapture(e.pointerId)
    return
  }
  if (hoveredLine.value) {
    draggingLine.value = { ...hoveredLine.value }
    return
  }
  if (editMode.value === 'custom') {
    const pos = getLogicPos(e)
    if (activeAxis.value === 'x') {
      linesX.value.push(pos.x)
      linesX.value.sort((a, b) => a - b)
    } else {
      linesY.value.push(pos.y)
      linesY.value.sort((a, b) => a - b)
    }
    saveMeta()
  }
}

const handlePointerMove = (e: PointerEvent) => {
  if (isPanning.value) {
    offset.value = { x: e.clientX - startPanPos.value.x, y: e.clientY - startPanPos.value.y }
    return
  }
  const pos = getLogicPos(e)
  mousePos.value = pos
  magnifierPos.value = { x: e.clientX, y: e.clientY }
  isAltPressed.value = e.altKey
  if (draggingLine.value) {
    const { axis, index } = draggingLine.value
    if (axis === 'x') linesX.value[index] = pos.x
    else linesY.value[index] = pos.y
    saveMeta()
    return
  }
  const threshold = 12 / scale.value
  let found = false
  for (let i = 0; i < linesX.value.length; i++) {
    if (Math.abs(pos.x - linesX.value[i]!) < threshold) {
      hoveredLine.value = { axis: 'x', index: i }
      found = true
      break
    }
  }
  if (!found) {
    for (let i = 0; i < linesY.value.length; i++) {
      if (Math.abs(pos.y - linesY.value[i]!) < threshold) {
        hoveredLine.value = { axis: 'y', index: i }
        found = true
        break
      }
    }
  }
  if (!found) hoveredLine.value = null
}

const handlePointerUp = () => {
  isPanning.value = false
  draggingLine.value = null
}

const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  if (!containerRef.value || !selectedImage.value) return
  const delta = e.deltaY > 0 ? 1 / 1.15 : 1.15
  const newScale = Math.max(0.05, Math.min(scale.value * delta, 20))
  const mouseX = e.clientX - containerLeft.value - containerWidth.value / 2
  const mouseY = e.clientY - containerTop.value - containerHeight.value / 2
  offset.value = {
    x: mouseX - (mouseX - offset.value.x) * (newScale / scale.value),
    y: mouseY - (mouseY - offset.value.y) * (newScale / scale.value)
  }
  scale.value = newScale
  updateCanvasRect()
}

const clearLines = () => {
  linesX.value = []
  linesY.value = []
  saveMeta()
}

const handleDownloadCurrent = () => {
  if (
    selectedImage.value?.status === 'done' &&
    (selectedImage.value.processedBlob || selectedImage.value.processedBlobs)
  )
    downloadImage(
      selectedImage.value.processedBlobs || selectedImage.value.processedBlob!,
      selectedImage.value.file.name,
      '_Split'
    )
}

const handleProcess = async () => {
  if (!selectedImage.value) return
  await processSingle(selectedImage.value.id, {
    rows: linesY.value.length + 1,
    cols: linesX.value.length + 1,
    mode: editMode.value,
    centerMode: centerMode.value,
    shave: shave.value,
    format: outputFormat.value === 'original' ? undefined : outputFormat.value,
    quality: outputQuality.value
  })
  handleDownloadCurrent()
}

const formatOptions = [
  { label: '保留原格式', value: 'original' },
  { label: 'WebP (推荐)', value: 'image/webp' },
  { label: 'JPEG (高兼容)', value: 'image/jpeg' },
  { label: 'PNG (无损)', value: 'image/png' }
]

watch(
  [
    rows,
    cols,
    editMode,
    centerMode,
    shave,
    outputFormat,
    outputQuality,
    () => [...linesX.value],
    () => [...linesY.value]
  ],
  () => {
    if (selectedImage.value?.status === 'done')
      store.updateImage(selectedImage.value.id, { isDirty: true })
  },
  { deep: true }
)

const buttonText = computed(() =>
  isProcessing.value
    ? '正在处理...'
    : selectedImage.value?.isDirty
      ? '重新切分并下载'
      : '切分并下载'
)
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
    <template #header-left><ImageSelectionStatus /></template>
    <template #header-actions
      ><ImageActionsToolbar :is-processing="isProcessing" :show-download-all="false" show-clear-all
    /></template>

    <template #content>
      <div class="h-full flex flex-col p-4 md:p-6 overflow-hidden w-full relative">
        <div
          ref="containerRef"
          class="flex-1 bg-muted/10 border border-border/40 rounded-3xl overflow-hidden relative w-full group select-none touch-none"
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
            <div class="relative shadow-2xl">
              <canvas ref="canvasRef" class="block rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #sidebar>
      <section class="space-y-5">
        <AppSectionHeader title="网格设置" :icon="Grid3X3" />
        <div class="space-y-4 px-1">
          <AppSegmentedControl
            v-model="editMode"
            :options="[
              { label: '均分网格', value: 'grid', icon: Grid3X3 },
              { label: '自由编辑', value: 'custom', icon: Scissors }
            ]"
          />
          <div
            v-if="editMode === 'grid'"
            class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-6"
          >
            <AppSlider v-model="rows" label="垂直行数" :min="1" :max="10" :step="1" /><AppSlider
              v-model="cols"
              label="水平列数"
              :min="1"
              :max="10"
              :step="1"
            />
          </div>
          <div
            v-else
            class="bg-primary/5 rounded-2xl p-4 border border-primary/20 flex flex-col gap-4"
          >
            <div class="grid grid-cols-2 gap-2.5">
              <button
                @click="activeAxis = 'x'"
                class="py-2.5 rounded-xl border-2 transition-all font-bold text-xs"
                :class="
                  activeAxis === 'x'
                    ? 'bg-primary border-primary text-white shadow-md'
                    : 'bg-background border-border text-muted-foreground'
                "
              >
                垂直线
              </button>
              <button
                @click="activeAxis = 'y'"
                class="py-2.5 rounded-xl border-2 transition-all font-bold text-xs"
                :class="
                  activeAxis === 'y'
                    ? 'bg-primary border-primary text-white shadow-md'
                    : 'bg-background border-border text-muted-foreground'
                "
              >
                水平线
              </button>
            </div>
            <button
              @click="clearLines"
              class="w-full py-2 rounded-lg border border-border hover:border-destructive hover:text-destructive transition-all text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Trash2 :size="12" /> 清空所有线
            </button>
          </div>
        </div>
      </section>

      <section class="space-y-5">
        <AppSectionHeader title="增强处理" :icon="Layers" />
        <div class="space-y-4 px-1">
          <AppSegmentedControl
            v-model="centerMode"
            :options="[
              { label: '标准', value: 'none', icon: Grid3X3 },
              { label: '居中', value: 'center', icon: AlignCenter },
              { label: '正方形', value: 'square', icon: Box }
            ]"
          />
        </div>
      </section>

      <section class="space-y-5 pb-4">
        <AppSectionHeader title="保存配置" :icon="FileType" />
        <div class="space-y-4 px-1">
          <AppSelect v-model="outputFormat" :options="formatOptions" />
          <AppSlider
            v-if="outputFormat !== 'original' && outputFormat !== 'image/png'"
            v-model="outputQuality"
            label="导出质量"
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
          size="lg"
          variant="cta"
          class="w-full h-12 rounded-xl shadow-xl shadow-primary/10 active:scale-95 transition-all"
          :loading="isProcessing"
          :disabled="!store.images.length"
          @click="handleProcess"
        >
          <template #icon><Scissors v-if="!isProcessing" :size="18" class="mr-2" /></template>
          <span class="font-bold text-sm tracking-tight">{{ buttonText }}</span>
        </AppButton>
      </InspectorFooter>
    </template>
  </WorkspaceLayout>
</template>
