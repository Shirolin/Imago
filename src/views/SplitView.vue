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
  MousePointerSquareDashed
} from 'lucide-vue-next'
import { splitEngine } from '../lib/engines/splitEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useResizeObserver, useElementBounding } from '@vueuse/core'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const { downloadImage } = useFileHelpers()

// --- 基础状态 ---
const rows = ref(3)
const cols = ref(3)
const centerMode = ref<'none' | 'center' | 'square'>('none')
const shave = ref(0)
const outputFormat = ref<string>('original')
const outputQuality = ref(0.9)

const { isProcessing, processSingle } = useImageProcessor(splitEngine)

// 全局状态绑定
const selectedImage = computed(() => store.activeImage)

// --- 画布交互引擎 ---
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
    if (!isPreview) {
      ctx.fillStyle = activeColor
      const dotSize = 4 / scale.value
      if (isVertical) {
        ctx.fillRect(pos - dotSize, 0, dotSize * 2, dotSize * 2)
        ctx.fillRect(pos - dotSize, img.height! - dotSize * 2, dotSize * 2, dotSize * 2)
      } else {
        ctx.fillRect(0, pos - dotSize, dotSize * 2, dotSize * 2)
        ctx.fillRect(img.width! - dotSize * 2, pos - dotSize, dotSize * 2, dotSize * 2)
      }
    }
    ctx.restore()
  }
  linesX.value.forEach((lx, i) =>
    drawStylizedLine(lx, true, hoveredLine.value?.axis === 'x' && hoveredLine.value.index === i)
  )
  linesY.value.forEach((ly, i) =>
    drawStylizedLine(ly, false, hoveredLine.value?.axis === 'y' && hoveredLine.value.index === i)
  )
  if (editMode.value === 'custom' && !draggingLine.value) {
    const snappedPos = snap(
      activeAxis.value === 'x' ? mousePos.value.x : mousePos.value.y,
      activeAxis.value,
      isAltPressed.value
    )
    drawStylizedLine(snappedPos, activeAxis.value === 'x', false, true)
  }
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

const syncGridLines = () => {
  const img = selectedImage.value
  if (!img || editMode.value === 'custom') return
  linesX.value = []
  linesY.value = []
  for (let i = 1; i < cols.value; i++) linesX.value.push((img.width! * i) / cols.value)
  for (let i = 1; i < rows.value; i++) linesY.value.push((img.height! * i) / rows.value)
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
  if (selectedImage.value) {
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
    } else {
      rows.value = 3
      cols.value = 3
      editMode.value = 'grid'
      syncGridLines()
    }
    nextTick(resetView)
  },
  { immediate: true }
)

watch([scale, offset, linesX, linesY, hoveredLine, mousePos, isAltPressed], requestDraw)

const getLogicPos = (e: PointerEvent) => {
  if (!cachedCanvasRect) updateCanvasRect()
  const rect = cachedCanvasRect!
  return { x: (e.clientX - rect.left) / scale.value, y: (e.clientY - rect.top) / scale.value }
}

const snap = (val: number, axis: 'x' | 'y', skip: boolean = false) => {
  if (!selectedImage.value || skip) {
    isSnapping.value = false
    return val
  }
  const threshold = 15 / scale.value
  const max = axis === 'x' ? selectedImage.value.width! : selectedImage.value.height!
  for (const t of [0, max / 2, max]) {
    if (Math.abs(val - t) < threshold) {
      isSnapping.value = true
      return t
    }
  }
  isSnapping.value = false
  return val
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
    const snapped = snap(activeAxis.value === 'x' ? pos.x : pos.y, activeAxis.value, e.altKey)
    if (activeAxis.value === 'x') {
      linesX.value.push(snapped)
      linesX.value.sort((a, b) => a - b)
    } else {
      linesY.value.push(snapped)
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
    const snapped = snap(axis === 'x' ? pos.x : pos.y, axis, e.altKey)
    if (axis === 'x') linesX.value[index] = snapped
    else linesY.value[index] = snapped
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

const handleDoubleClick = () => {
  if (hoveredLine.value) {
    const { axis, index } = hoveredLine.value
    if (axis === 'x') linesX.value.splice(index, 1)
    else linesY.value.splice(index, 1)
    hoveredLine.value = null
    saveMeta()
  }
}

const handlePointerUp = () => {
  isPanning.value = false
  draggingLine.value = null
  isSnapping.value = false
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

const zoomIn = () => {
  scale.value *= 1.2
  updateCanvasRect()
}
const zoomOut = () => {
  scale.value *= 0.8
  updateCanvasRect()
}

useResizeObserver(containerRef, resetView)

onMounted(() => {
  window.addEventListener('keydown', (e) => (isAltPressed.value = e.altKey))
  window.addEventListener('keyup', (e) => (isAltPressed.value = e.altKey))
})

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
  <WorkspaceLayout show-sidebar no-scroll>
    <template #header-left><ImageSelectionStatus /></template>
    <template #header-actions
      ><ImageActionsToolbar :is-processing="isProcessing" :show-download-all="false" show-clear-all
    /></template>

    <template #content>
      <div
        class="h-full flex flex-col p-4 md:p-6 animate-in fade-in duration-500 overflow-hidden w-full relative"
      >
        <div
          ref="containerRef"
          class="flex-1 bg-muted/10 border border-border/40 rounded-3xl overflow-hidden relative w-full group select-none touch-none"
          :class="{
            'cursor-grabbing': isPanning,
            'cursor-crosshair': editMode === 'custom' && !hoveredLine,
            'cursor-col-resize': hoveredLine?.axis === 'x',
            'cursor-row-resize': hoveredLine?.axis === 'y'
          }"
          @wheel="handleWheel"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointerleave="handlePointerUp"
        >
          <div class="absolute inset-0 transparency-grid opacity-40"></div>
          <div
            class="absolute inset-0 flex items-center justify-center"
            :style="{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }"
          >
            <div
              class="relative shadow-2xl transition-shadow duration-500 will-change-transform"
              :class="{ 'shadow-primary/20': isSnapping && !isAltPressed }"
            >
              <canvas
                ref="canvasRef"
                class="block rounded-sm bg-black/5"
                @dblclick="handleDoubleClick"
              />
            </div>
          </div>

          <!-- 悬浮放大镜 -->
          <div
            v-if="draggingLine"
            class="absolute z-50 w-36 h-36 rounded-full border-4 shadow-2xl pointer-events-none overflow-hidden bg-black flex flex-col transition-all duration-200"
            :class="isAltPressed ? 'border-muted-foreground scale-90' : 'border-white'"
            :style="{ left: magnifierPos.x - 72 + 'px', top: magnifierPos.y - 180 + 'px' }"
          >
            <div class="relative flex-1">
              <div
                class="absolute inset-0"
                :style="{
                  backgroundImage: `url(${selectedImage?.preview})`,
                  backgroundPosition: `${-(mousePos.x * scale * 2.5) + 72}px ${-(mousePos.y * scale * 2.5) + 72}px`,
                  backgroundSize: `${(selectedImage?.width || 0) * scale * 2.5}px ${(selectedImage?.height || 0) * scale * 2.5}px`,
                  backgroundRepeat: 'no-repeat'
                }"
              ></div>
              <div class="absolute inset-0 flex items-center justify-center z-20">
                <div
                  class="w-1.5 h-1.5 rounded-full ring-2 ring-white"
                  :class="isAltPressed ? 'bg-muted-foreground' : 'bg-primary shadow-lg'"
                ></div>
                <div
                  class="absolute w-full h-[1px]"
                  :class="isAltPressed ? 'bg-white/20' : 'bg-primary/40'"
                ></div>
                <div
                  class="absolute h-full w-[1px]"
                  :class="isAltPressed ? 'bg-white/20' : 'bg-primary/40'"
                ></div>
              </div>
            </div>
            <div
              class="h-7 flex items-center justify-center border-t px-2 shrink-0 transition-colors"
              :class="isAltPressed ? 'bg-muted/80 border-white/5' : 'bg-black border-white/10'"
            >
              <span
                class="text-[0.6rem] text-white font-mono font-black tracking-tighter uppercase flex items-center gap-2"
              >
                <div
                  v-if="isSnapping && !isAltPressed"
                  class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
                ></div>
                <MousePointerSquareDashed
                  v-if="isAltPressed"
                  :size="10"
                  class="text-muted-foreground"
                />
                {{
                  isAltPressed
                    ? 'Free Mode'
                    : isSnapping
                      ? 'Snapped'
                      : `${Math.round(mousePos.x)}px, ${Math.round(mousePos.y)}px`
                }}
              </span>
            </div>
          </div>

          <!-- 底部缩放控制 -->
          <div
            class="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1.5 bg-background/80 backdrop-blur-2xl border border-border/60 rounded-2xl shadow-elevated"
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
              @click="resetView"
              class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-primary/10 text-primary"
              title="重置视图"
            >
              <Maximize :size="18" />
            </button>
          </div>

          <!-- 快捷提示 -->
          <div
            class="absolute top-6 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-black/40 backdrop-blur-md border border-white/5 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center gap-4"
          >
            <span
              class="text-[0.65rem] text-white/90 font-black uppercase tracking-[0.2em] flex items-center gap-2"
              ><Grip :size="14" class="text-primary" /> 滚轮缩放 • Shift+平移</span
            >
            <div class="w-px h-3 bg-white/10"></div>
            <span
              class="text-[0.65rem] text-white/90 font-black uppercase tracking-[0.2em] flex items-center gap-2"
              :class="{ 'text-primary animate-pulse': isAltPressed }"
              ><Keyboard :size="14" /> Alt 禁用吸附 • 双击删除</span
            >
          </div>
        </div>
      </div>
    </template>

    <template #sidebar>
      <div class="flex flex-col h-full relative">
        <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10">
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
                class="bg-muted/10 rounded-2xl p-5 border border-border/60 space-y-6 animate-in zoom-in-95 duration-300"
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
                class="bg-primary/5 rounded-2xl p-5 border border-primary/20 space-y-5 animate-in zoom-in-95 duration-300"
              >
                <div class="flex flex-col gap-3">
                  <label
                    class="text-[0.65rem] font-black text-primary uppercase tracking-widest px-1"
                    >添加新线轴向</label
                  >
                  <div class="grid grid-cols-2 gap-2.5">
                    <button
                      @click="activeAxis = 'x'"
                      class="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-black text-xs"
                      :class="
                        activeAxis === 'x'
                          ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20'
                          : 'bg-background border-border text-muted-foreground hover:border-primary/40'
                      "
                    >
                      垂直线
                    </button>
                    <button
                      @click="activeAxis = 'y'"
                      class="flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-black text-xs"
                      :class="
                        activeAxis === 'y'
                          ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20'
                          : 'bg-background border-border text-muted-foreground hover:border-primary/40'
                      "
                    >
                      水平线
                    </button>
                  </div>
                </div>
                <button
                  @click="clearLines"
                  class="w-full py-2.5 rounded-xl border border-border hover:border-destructive hover:text-destructive transition-all text-[0.6rem] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  清空所有线条
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
              <div
                v-if="centerMode !== 'none'"
                class="pt-2 space-y-4 animate-in fade-in duration-300"
              >
                <AppSlider
                  v-model="shave"
                  label="边缘修剪"
                  :min="0"
                  :max="20"
                  :step="1"
                  unit="px"
                />
              </div>
            </div>
          </section>

          <section class="space-y-5">
            <AppSectionHeader title="导出配置" :icon="FileType" />
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
        </div>

        <InspectorFooter>
          <AppButton
            size="lg"
            variant="cta"
            class="w-full h-14 rounded-2xl shadow-xl shadow-primary/10 hover:-translate-y-0.5 active:scale-95 transition-all"
            :loading="isProcessing"
            :disabled="!store.images.length"
            @click="handleProcess"
          >
            <template #icon><Scissors v-if="!isProcessing" :size="20" class="mr-2.5" /></template>
            <span class="font-bold tracking-tight text-base">{{ buttonText }}</span>
          </AppButton>
        </InspectorFooter>
      </div>
    </template>
  </WorkspaceLayout>
</template>

<style scoped>
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
