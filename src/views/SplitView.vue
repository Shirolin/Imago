<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useImageStore, type ImageItem } from '../stores/imageStore'
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
  RefreshCw,
  Box,
  AlignCenter,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grip,
  CheckCircle2,
  Keyboard,
  MousePointerSquareDashed
} from 'lucide-vue-next'
import { splitEngine } from '../lib/engines/splitEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useResizeObserver, useElementBounding } from '@vueuse/core'

const store = useImageStore()
const { downloadImage } = useFileHelpers()

// --- 基础状态 ---
const rows = ref(3)
const cols = ref(3)
const centerMode = ref<'none' | 'center' | 'square'>('none')
const shave = ref(0)
const outputFormat = ref<string>('original')
const outputQuality = ref(0.9)
const selectedImageId = ref<string | null>(null)

const { isProcessing, processSingle } = useImageProcessor(splitEngine)

const selectedImage = computed(() => {
  if (!store.images.length) return null
  return (
    store.images.find((img) => img.id === selectedImageId.value) ||
    store.images[store.images.length - 1] ||
    null
  )
})

const displayImages = computed(() => [...store.images].reverse())

// --- 画布交互引擎 ---
const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const scale = ref(1)
const offset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const startPanPos = ref({ x: 0, y: 0 })

// 模式与轴向
const editMode = ref<'grid' | 'custom'>('grid')
const activeAxis = ref<'x' | 'y'>('x')

// 交互精细状态
const draggingLine = ref<{ axis: 'x' | 'y'; index: number } | null>(null)
const hoveredLine = ref<{ axis: 'x' | 'y'; index: number } | null>(null)
const isSnapping = ref(false)
const mousePos = ref({ x: 0, y: 0 })
const magnifierPos = ref({ x: 0, y: 0 })
const isAltPressed = ref(false)

// 网格线数据
const linesX = ref<number[]>([])
const linesY = ref<number[]>([])

// --- 性能优化：布局缓存 ---
let cachedCanvasRect: DOMRect | null = null
const updateCanvasRect = () => {
  if (canvasRef.value) cachedCanvasRect = canvasRef.value.getBoundingClientRect()
}

// 缓存离屏 Canvas
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
    // 创建离屏 Canvas 预渲染图片
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

  const w = img.width!
  const h = img.height!
  canvas.width = w
  canvas.height = h

  // 极速绘制：直接从离屏 Canvas 拷贝，避免浏览器重新解析图片像素
  ctx.clearRect(0, 0, w, h)
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
      ctx.lineTo(pos + 1 / scale.value, h)
    } else {
      ctx.moveTo(0, pos + 1 / scale.value)
      ctx.lineTo(w, pos + 1 / scale.value)
    }
    ctx.stroke()

    ctx.beginPath()
    if (isPreview) ctx.setLineDash([5, 5])
    ctx.lineWidth = (isHovered ? 3 : 1.5) / scale.value
    ctx.strokeStyle = isPreview ? 'rgba(255,255,255,0.7)' : activeColor
    if (isVertical) {
      ctx.moveTo(pos, 0)
      ctx.lineTo(pos, h)
    } else {
      ctx.moveTo(0, pos)
      ctx.lineTo(w, pos)
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
        ctx.fillRect(pos - dotSize, h - dotSize * 2, dotSize * 2, dotSize * 2)
      } else {
        ctx.fillRect(0, pos - dotSize, dotSize * 2, dotSize * 2)
        ctx.fillRect(w - dotSize * 2, pos - dotSize, dotSize * 2, dotSize * 2)
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
  if (isDrawingRaf) return
  isDrawingRaf = true
  requestAnimationFrame(() => {
    draw()
    isDrawingRaf = false
  })
}

const syncGridLines = () => {
  const img = selectedImage.value
  if (!img || editMode.value === 'custom') return
  const w = img.width!
  const h = img.height!
  linesX.value = []
  linesY.value = []
  for (let i = 1; i < cols.value; i++) linesX.value.push((w * i) / cols.value)
  for (let i = 1; i < rows.value; i++) linesY.value.push((h * i) / rows.value)
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
  const cw = container.clientWidth - 80
  const ch = container.clientHeight - 80
  scale.value = Math.min(cw / img.width!, ch / img.height!, 1)
  offset.value = { x: 0, y: 0 }
  setTimeout(updateCanvasRect, 100)
}

const saveMeta = () => {
  const img = selectedImage.value
  if (img) {
    store.updateImage(img.id, {
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

// --- 状态恢复与同步 ---
watch(
  () => selectedImage.value?.id,
  (newId) => {
    if (!newId) return
    const img = selectedImage.value
    if (img?.splitMeta) {
      const meta = img.splitMeta
      editMode.value = meta.editMode
      rows.value = meta.rows
      cols.value = meta.cols
      linesX.value = [...meta.linesX]
      linesY.value = [...meta.linesY]
    } else {
      rows.value = 3
      cols.value = 3
      editMode.value = 'grid'
      syncGridLines()
    }
    resetView()
  },
  { immediate: true }
)

watch([scale, offset, linesX, linesY, hoveredLine, mousePos, isAltPressed], requestDraw)

const getLogicPos = (e: PointerEvent) => {
  if (!cachedCanvasRect) updateCanvasRect()
  const rect = cachedCanvasRect!
  return {
    x: (e.clientX - rect.left) / scale.value,
    y: (e.clientY - rect.top) / scale.value
  }
}

const snap = (val: number, axis: 'x' | 'y', skip: boolean = false) => {
  const img = selectedImage.value
  if (!img || skip) {
    isSnapping.value = false
    return val
  }
  const threshold = 15 / scale.value
  const max = axis === 'x' ? img.width! : img.height!
  const targets = [0, max / 2, max]
  for (const t of targets) {
    if (Math.abs(val - t) < threshold) {
      isSnapping.value = true
      return t
    }
  }
  isSnapping.value = false
  return val
}

const handlePointerDown = (e: PointerEvent) => {
  const container = containerRef.value
  if (!container) return
  updateCanvasRect()
  if (e.button === 1 || e.shiftKey) {
    isPanning.value = true
    startPanPos.value = { x: e.clientX - offset.value.x, y: e.clientY - offset.value.y }
    container.setPointerCapture(e.pointerId)
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
    if (axis === 'x') {
      const lineArr = linesX.value
      if (lineArr[index] !== undefined) lineArr[index] = snapped
    } else {
      const lineArr = linesY.value
      if (lineArr[index] !== undefined) lineArr[index] = snapped
    }
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
  const img = selectedImage.value
  const container = containerRef.value
  if (!container || !img) return
  const zoomStep = 1.15
  const delta = e.deltaY > 0 ? 1 / zoomStep : zoomStep
  const newScale = Math.max(0.05, Math.min(scale.value * delta, 20))

  // 将鼠标坐标转换为相对于容器中心的坐标，以匹配 flex center 布局下的 offset 系统
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

const handleKey = (e: KeyboardEvent) => {
  isAltPressed.value = e.altKey
}
onMounted(() => {
  window.addEventListener('keydown', handleKey)
  window.addEventListener('keyup', handleKey)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKey)
  window.removeEventListener('keyup', handleKey)
})

const clearLines = () => {
  linesX.value = []
  linesY.value = []
  saveMeta()
}

const handleDownloadCurrent = () => {
  const img = selectedImage.value
  if (img?.status === 'done' && (img.processedBlob || img.processedBlobs)) {
    downloadImage(img.processedBlobs || img.processedBlob!, img.file.name, '_Split')
  }
}

const handleProcess = async () => {
  const img = selectedImage.value
  if (!img) return
  const options = {
    rows: linesY.value.length + 1,
    cols: linesX.value.length + 1,
    mode: editMode.value,
    centerMode: centerMode.value,
    shave: shave.value,
    format: outputFormat.value === 'original' ? undefined : outputFormat.value,
    quality: outputQuality.value
  }
  await processSingle(img.id, options)
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
    const img = selectedImage.value
    if (img && img.status === 'done') store.updateImage(img.id, { isDirty: true })
  },
  { deep: true }
)

const buttonText = computed(() => {
  if (isProcessing.value) return '正在处理...'
  const img = selectedImage.value
  if (img?.isDirty) return '重新切分并下载'
  return '切分并下载'
})

const showMagnifier = computed(() => !!draggingLine.value)

// --- 模板样式计算属性 (修复解析错误) ---
const containerClasses = computed(() => ({
  'cursor-grabbing': isPanning.value,
  'cursor-crosshair': editMode.value === 'custom' && !hoveredLine.value,
  'cursor-col-resize': hoveredLine.value?.axis === 'x',
  'cursor-row-resize': hoveredLine.value?.axis === 'y'
}))

const magnifierClasses = computed(() =>
  isAltPressed.value ? 'border-muted-foreground scale-90' : 'border-white'
)

const hintClasses = computed(() => ({
  'text-primary animate-pulse': isAltPressed.value
}))

const canvasContainerClasses = computed(() => ({
  'shadow-primary/20': isSnapping.value && !isAltPressed.value
}))

const dotClasses = computed(() =>
  isAltPressed.value
    ? 'bg-muted-foreground'
    : 'bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),1)]'
)

const crosshairClasses = computed(() => (isAltPressed.value ? 'bg-white/20' : 'bg-primary/40'))

const magnifierFooterClasses = computed(() =>
  isAltPressed.value ? 'bg-muted/80 border-white/5' : 'bg-black border-white/10'
)

const imageCardClasses = (img: ImageItem) => ({
  'border-primary shadow-sm scale-110 z-10': selectedImage.value?.id === img.id,
  'border-transparent hover:border-border': selectedImage.value?.id !== img.id
})
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll>
    <template #header-left>
      <ImageSelectionStatus />
    </template>

    <template #header-actions>
      <ImageActionsToolbar
        :is-processing="isProcessing"
        :show-download-all="false"
        show-clear-all
      />
    </template>

    <template #content>
      <div
        class="h-full flex flex-col gap-3 p-4 md:p-6 animate-in fade-in duration-500 overflow-hidden w-full"
      >
        <div
          ref="containerRef"
          class="flex-1 min-h-0 bg-muted/10 border border-border/40 rounded-3xl overflow-hidden relative w-full group select-none touch-none"
          :class="containerClasses"
          @wheel="handleWheel"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointerleave="handlePointerUp"
        >
          <div class="absolute inset-0 transparency-grid"></div>
          <div
            class="absolute inset-0 flex items-center justify-center"
            :style="{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }"
          >
            <div
              class="relative shadow-2xl transition-shadow duration-500 will-change-transform"
              :class="canvasContainerClasses"
            >
              <canvas
                ref="canvasRef"
                class="block rounded-sm bg-black/5"
                @dblclick="handleDoubleClick"
              />
            </div>
          </div>

          <div
            v-if="showMagnifier"
            class="absolute z-50 w-36 h-36 rounded-full border-4 shadow-2xl pointer-events-none overflow-hidden bg-black flex flex-col transition-all duration-200"
            :class="magnifierClasses"
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
                <div class="w-1.5 h-1.5 rounded-full ring-2 ring-white" :class="dotClasses"></div>
                <div class="absolute w-full h-[1px]" :class="crosshairClasses"></div>
                <div class="absolute h-full w-[1px]" :class="crosshairClasses"></div>
              </div>
            </div>
            <div
              class="h-7 flex items-center justify-center border-t px-2 shrink-0 transition-colors"
              :class="magnifierFooterClasses"
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

          <div class="absolute top-4 left-4 right-4 z-30 pointer-events-none">
            <div
              class="flex gap-2 p-2 bg-background/60 backdrop-blur-xl border border-border/40 rounded-2xl overflow-x-auto no-scrollbar shadow-elevated w-fit max-w-full mx-auto pointer-events-auto"
            >
              <button
                v-for="img in displayImages"
                :key="img.id"
                class="w-10 h-10 rounded-lg overflow-hidden shrink-0 cursor-pointer border-2 transition-all relative"
                :class="imageCardClasses(img)"
                @click="selectedImageId = img.id"
                :title="img.file.name"
              >
                <img :src="img.preview" alt="" class="w-full h-full object-cover" />
                <div
                  v-if="img.status === 'done'"
                  class="absolute inset-0 bg-primary/20 flex items-center justify-center"
                >
                  <CheckCircle2 :size="14" class="text-primary" />
                </div>
              </button>
            </div>
          </div>

          <div
            class="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1.5 bg-background/80 backdrop-blur-2xl border border-border/60 rounded-2xl shadow-elevated"
          >
            <button
              @click="zoomOut"
              class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              aria-label="缩小视图"
            >
              <ZoomOut :size="18" />
            </button>
            <div class="px-2 min-w-[60px] text-center border-x border-border/20 font-mono">
              <span class="text-xs font-black text-foreground">{{ Math.round(scale * 100) }}%</span>
            </div>
            <button
              @click="zoomIn"
              class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              aria-label="放大视图"
            >
              <ZoomIn :size="18" />
            </button>
            <div class="w-px h-4 bg-border/20 mx-1"></div>
            <button
              @click="resetView"
              class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              title="重置视图"
              aria-label="重置视图比例"
            >
              <Maximize :size="18" />
            </button>
          </div>

          <div
            class="absolute top-20 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-black/40 backdrop-blur-md border border-white/5 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center gap-4"
          >
            <span
              class="text-[0.65rem] text-white/90 font-black uppercase tracking-[0.2em] flex items-center gap-2"
              ><Grip :size="14" class="text-primary" /> 滚轮缩放 • Shift+平移</span
            >
            <div class="w-px h-3 bg-white/10"></div>
            <span
              class="text-[0.65rem] text-white/90 font-black uppercase tracking-[0.2em] flex items-center gap-2"
              :class="hintClasses"
              ><Keyboard :size="14" /> Alt 禁用吸附 • 双击删除</span
            >
          </div>
        </div>

        <div class="flex items-center justify-between px-1 shrink-0 h-8">
          <div class="flex items-center gap-2 text-muted-foreground/40">
            <RefreshCw :size="12" class="animate-spin-slow" /><span
              class="text-[0.55rem] font-bold uppercase tracking-wider font-mono"
              >Pixel-Perfect Editing</span
            >
          </div>
          <span class="text-[0.6rem] font-black uppercase tracking-widest text-primary/60"
            >Ready to Export {{ (linesX.length + 1) * (linesY.length + 1) }} Tiles</span
          >
        </div>
      </div>
    </template>

    <template #sidebar>
      <div class="p-6 flex flex-col gap-8 h-full overflow-hidden bg-background">
        <div class="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-8">
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
                class="bg-muted/10 rounded-2xl p-5 border border-border/60 shadow-inner space-y-6 animate-in zoom-in-95 duration-300"
              >
                <AppSlider v-model="rows" label="垂直行数 (Rows)" :min="1" :max="10" :step="1" />
                <AppSlider v-model="cols" label="水平列数 (Cols)" :min="1" :max="10" :step="1" />
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
              <div class="flex justify-between items-center px-1 pt-2">
                <div class="flex flex-col">
                  <span
                    class="text-[0.55rem] font-black text-muted-foreground/40 uppercase tracking-widest"
                    >Total Tiles</span
                  >
                  <span class="text-xl font-black text-primary font-mono leading-none">{{
                    (linesX.length + 1) * (linesY.length + 1)
                  }}</span>
                </div>
                <div class="text-right">
                  <span
                    class="text-[0.55rem] font-black text-muted-foreground/40 uppercase tracking-widest"
                    >Active Lines</span
                  >
                  <p class="text-[0.7rem] font-bold text-foreground">
                    {{ linesX.length }}V / {{ linesY.length }}H
                  </p>
                </div>
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
                  label="边缘修剪 (Shave)"
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
        <div class="pt-4 border-t border-border shrink-0">
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
        </div>
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
