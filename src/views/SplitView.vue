<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useImageStore } from '../stores/imageStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppTip from '../components/common/AppTip.vue'
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
  ChevronUp,
  ChevronDown
} from 'lucide-vue-next'
import { splitEngine } from '../lib/engines/splitEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useResizeObserver } from '@vueuse/core'

const store = useImageStore()

// --- 基础状态 ---
const rows = ref(3)
const cols = ref(3)
const centerMode = ref<'none' | 'center' | 'square'>('none')
const shave = ref(0)
const outputFormat = ref<string>('original')
const outputQuality = ref(0.9)
const selectedImageId = ref<string | null>(null)

const { isProcessing, processAll, processSelected } = useImageProcessor(splitEngine)

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

// 模式：grid (均分), custom (自由编辑)
const editMode = ref<'grid' | 'custom'>('grid')
const activeAxis = ref<'x' | 'y'>('x')

// 交互状态
const draggingLine = ref<{ axis: 'x' | 'y'; index: number } | null>(null)
const isSnapping = ref(false)
const mousePos = ref({ x: 0, y: 0 })

// 网格线数据
const linesX = ref<number[]>([])
const linesY = ref<number[]>([])

// 性能优化：缓存 Image 对象
let cachedImage: HTMLImageElement | null = null
let isDrawingRaf = false

const updateCachedImage = () => {
  const imgData = selectedImage.value
  if (!imgData) {
    cachedImage = null
    return
  }
  const img = new Image()
  img.src = imgData.preview
  img.onload = () => {
    cachedImage = img
    requestDraw()
  }
}

watch(() => selectedImage.value?.id, updateCachedImage, { immediate: true })

const requestDraw = () => {
  if (isDrawingRaf) return
  isDrawingRaf = true
  requestAnimationFrame(() => {
    draw()
    isDrawingRaf = false
  })
}

// 初始化/同步网格线
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

watch([rows, cols, editMode, () => selectedImage.value?.id], syncGridLines, { immediate: true })

// 画布绘制逻辑
const draw = () => {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  const img = selectedImage.value
  if (!canvas || !ctx || !cachedImage || !img) return

  const w = img.width!
  const h = img.height!
  canvas.width = w
  canvas.height = h

  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(cachedImage, 0, 0)

  const drawLine = (pos: number, isVertical: boolean) => {
    ctx.beginPath()
    ctx.setLineDash([10, 10])
    ctx.lineWidth = 2 / scale.value
    ctx.strokeStyle = 'hsl(var(--primary))'
    if (isVertical) {
      ctx.moveTo(pos, 0)
      ctx.lineTo(pos, h)
    } else {
      ctx.moveTo(0, pos)
      ctx.lineTo(w, pos)
    }
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.lineWidth = 6 / scale.value
    ctx.stroke()
    ctx.restore()
    ctx.stroke()
  }

  linesX.value.forEach((x) => drawLine(x, true))
  linesY.value.forEach((y) => drawLine(y, false))
}

watch([scale, offset, linesX, linesY], requestDraw)

const resetView = () => {
  const img = selectedImage.value
  const container = containerRef.value
  if (!container || !img) return
  const w = img.width!
  const h = img.height!
  const cw = container.clientWidth - 80
  const ch = container.clientHeight - 80
  scale.value = Math.min(cw / w, ch / h, 1)
  offset.value = { x: 0, y: 0 }
}

useResizeObserver(containerRef, resetView)
watch(() => selectedImage.value?.id, resetView)

const magnifierPos = ref({ x: 0, y: 0 })
const showMagnifier = computed(() => !!draggingLine.value)

const getLogicPos = (e: PointerEvent) => {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) / scale.value,
    y: (e.clientY - rect.top) / scale.value
  }
}

const snap = (val: number, axis: 'x' | 'y') => {
  const img = selectedImage.value
  if (!img) return val
  const threshold = 10 / scale.value
  const max = axis === 'x' ? img.width! : img.height!
  if (Math.abs(val) < threshold) {
    isSnapping.value = true
    return 0
  }
  if (Math.abs(val - max) < threshold) {
    isSnapping.value = true
    return max
  }
  if (Math.abs(val - max / 2) < threshold) {
    isSnapping.value = true
    return max / 2
  }
  isSnapping.value = false
  return val
}

const handlePointerDown = (e: PointerEvent) => {
  const container = containerRef.value
  if (!container) return
  if (e.button === 1 || e.shiftKey) {
    isPanning.value = true
    startPanPos.value = { x: e.clientX - offset.value.x, y: e.clientY - offset.value.y }
    container.setPointerCapture(e.pointerId)
    return
  }
  const pos = getLogicPos(e)
  const threshold = 12 / scale.value
  for (let i = 0; i < linesX.value.length; i++) {
    const lx = linesX.value[i]
    if (lx !== undefined && Math.abs(pos.x - lx) < threshold) {
      draggingLine.value = { axis: 'x', index: i }
      return
    }
  }
  for (let i = 0; i < linesY.value.length; i++) {
    const ly = linesY.value[i]
    if (ly !== undefined && Math.abs(pos.y - ly) < threshold) {
      draggingLine.value = { axis: 'y', index: i }
      return
    }
  }
  if (editMode.value === 'custom') {
    if (activeAxis.value === 'x') {
      linesX.value.push(pos.x)
      linesX.value.sort((a, b) => a - b)
    } else {
      linesY.value.push(pos.y)
      linesY.value.sort((a, b) => a - b)
    }
  }
}

const handlePointerMove = (e: PointerEvent) => {
  if (isPanning.value) {
    offset.value = { x: e.clientX - startPanPos.value.x, y: e.clientY - startPanPos.value.y }
    return
  }
  const pos = getLogicPos(e)
  mousePos.value = pos
  if (draggingLine.value) {
    const { axis, index } = draggingLine.value
    const snapped = snap(axis === 'x' ? pos.x : pos.y, axis)
    if (axis === 'x') {
      const lineArr = linesX.value
      if (lineArr[index] !== undefined) lineArr[index] = snapped
    } else {
      const lineArr = linesY.value
      if (lineArr[index] !== undefined) lineArr[index] = snapped
    }
    magnifierPos.value = { x: e.clientX, y: e.clientY }
  }
}

const handleDoubleClick = (e: MouseEvent) => {
  const pos = getLogicPos(e as any)
  const threshold = 12 / scale.value
  const idxX = linesX.value.findIndex((x) => Math.abs(x - pos.x) < threshold)
  if (idxX !== -1) {
    linesX.value.splice(idxX, 1)
    return
  }
  const idxY = linesY.value.findIndex((y) => Math.abs(y - pos.y) < threshold)
  if (idxY !== -1) {
    linesY.value.splice(idxY, 1)
    return
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
  const zoomStep = 1.1
  const delta = e.deltaY > 0 ? 1 / zoomStep : zoomStep
  const newScale = Math.max(0.1, Math.min(scale.value * delta, 10))
  const rect = container.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  offset.value = {
    x: mouseX - (mouseX - offset.value.x) * (newScale / scale.value),
    y: mouseY - (mouseY - offset.value.y) * (newScale / scale.value)
  }
  scale.value = newScale
}

const handleProcess = () => {
  const options = {
    rows: linesY.value.length + 1,
    cols: linesX.value.length + 1,
    mode: editMode.value,
    centerMode: centerMode.value,
    shave: shave.value,
    format: outputFormat.value === 'original' ? undefined : outputFormat.value,
    quality: outputQuality.value
  }
  if (store.selectedCount > 0) processSelected(options)
  else processAll(options)
}
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll>
    <template #header-left>
      <ImageSelectionStatus />
    </template>

    <template #header-actions>
      <ImageActionsToolbar :is-processing="isProcessing" show-clear-all zip-prefix="_Imago_Split" />
    </template>

    <template #content>
      <div
        class="h-full flex flex-col gap-3 p-4 md:p-6 animate-in fade-in duration-500 overflow-hidden w-full"
      >
        <div
          ref="containerRef"
          class="flex-1 min-h-0 bg-muted/10 border border-border/40 rounded-3xl overflow-hidden relative w-full group select-none touch-none"
          @wheel="handleWheel"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointerleave="handlePointerUp"
        >
          <div class="absolute inset-0 transparency-grid opacity-40"></div>
          <div
            class="absolute inset-0 flex items-center justify-center transition-transform duration-75"
            :style="{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }"
          >
            <div class="relative shadow-2xl">
              <canvas ref="canvasRef" class="block rounded-sm" @dblclick="handleDoubleClick" />
            </div>
          </div>

          <div
            v-if="showMagnifier"
            class="absolute z-50 w-32 h-32 rounded-full border-4 border-white shadow-2xl pointer-events-none overflow-hidden bg-black flex flex-col"
            :style="{ left: magnifierPos.x - 64 + 'px', top: magnifierPos.y - 160 + 'px' }"
          >
            <div class="relative flex-1">
              <div
                class="absolute inset-0"
                :style="{
                  backgroundImage: `url(${selectedImage?.preview})`,
                  backgroundPosition: `${-(mousePos.x * scale * 2) + 64}px ${-(mousePos.y * scale * 2) + 64}px`,
                  backgroundSize: `${(selectedImage?.width || 0) * scale * 2}px ${(selectedImage?.height || 0) * scale * 2}px`,
                  backgroundRepeat: 'no-repeat'
                }"
              ></div>
              <div class="absolute inset-0 flex items-center justify-center z-20">
                <div
                  class="w-1 h-1 bg-primary rounded-full shadow-[0_0_4px_rgba(var(--primary-rgb),0.8)]"
                ></div>
                <div class="absolute w-full h-[0.5px] bg-primary/30"></div>
                <div class="absolute h-full w-[0.5px] bg-primary/30"></div>
              </div>
            </div>
            <div
              class="h-6 bg-black flex items-center justify-center border-t border-white/10 px-2 shrink-0"
            >
              <span
                class="text-[0.6rem] text-white/80 font-mono font-bold tracking-tighter uppercase"
              >
                {{
                  isSnapping
                    ? 'Snapped'
                    : `${Math.round(mousePos.x)}px, ${Math.round(mousePos.y)}px`
                }}
              </span>
            </div>
          </div>

          <div class="absolute top-4 left-4 right-4 z-30">
            <div
              class="flex gap-2 p-2 bg-background/60 backdrop-blur-xl border border-border/40 rounded-2xl overflow-x-auto no-scrollbar shadow-elevated w-fit max-w-full mx-auto"
            >
              <button
                v-for="img in displayImages"
                :key="img.id"
                class="w-10 h-10 rounded-lg overflow-hidden shrink-0 cursor-pointer border-2 transition-all relative"
                :class="
                  selectedImage?.id === img.id
                    ? 'border-primary shadow-sm scale-110 z-10'
                    : 'border-transparent hover:border-border'
                "
                @click="selectedImageId = img.id"
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
              @click="scale *= 0.8"
              class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-all active:scale-90"
            >
              <ZoomOut :size="18" />
            </button>
            <div class="px-2 min-w-[60px] text-center border-x border-border/20">
              <span class="text-xs font-black font-mono text-foreground"
                >{{ Math.round(scale * 100) }}%</span
              >
            </div>
            <button
              @click="scale *= 1.2"
              class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-all active:scale-90"
            >
              <ZoomIn :size="18" />
            </button>
            <div class="w-px h-4 bg-border/20 mx-1"></div>
            <button
              @click="resetView"
              class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all active:scale-90"
              title="重置视图"
            >
              <Maximize :size="18" />
            </button>
          </div>

          <div
            class="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/20 backdrop-blur-md rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <span
              class="text-[0.6rem] text-white/80 font-black uppercase tracking-[0.2em] flex items-center gap-2"
            >
              <Grip :size="12" /> 滚轮缩放 • Shift+拖拽平移
            </span>
          </div>
        </div>

        <div class="flex items-center justify-between px-1 shrink-0 h-8">
          <div class="flex items-center gap-2 text-muted-foreground/40">
            <RefreshCw :size="12" />
            <span class="text-[0.55rem] font-bold uppercase tracking-wider font-mono"
              >Dynamic Canvas Rendering</span
            >
          </div>
          <span class="text-[0.6rem] font-black uppercase tracking-widest text-primary/60">
            Ready to Export {{ (linesX.length + 1) * (linesY.length + 1) }} Tiles per Image
          </span>
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
                class="bg-muted/10 rounded-2xl p-5 border border-border/60 shadow-inner space-y-6 animate-in fade-in duration-300"
              >
                <AppSlider v-model="rows" label="垂直行数 (Rows)" :min="1" :max="10" :step="1" />
                <AppSlider v-model="cols" label="水平列数 (Cols)" :min="1" :max="10" :step="1" />
              </div>
              <div
                v-else
                class="bg-primary/5 rounded-2xl p-5 border border-primary/20 space-y-4 animate-in fade-in duration-300"
              >
                <div class="flex flex-col gap-3">
                  <label
                    class="text-[0.6rem] font-black text-primary uppercase tracking-widest px-1"
                    >添加新切线轴向</label
                  >
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      @click="activeAxis = 'x'"
                      class="flex items-center justify-center gap-2 py-2 rounded-xl border transition-all font-bold text-xs"
                      :class="
                        activeAxis === 'x'
                          ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20'
                          : 'bg-background border-border text-muted-foreground hover:border-primary/40'
                      "
                    >
                      垂直线 (X)
                    </button>
                    <button
                      @click="activeAxis = 'y'"
                      class="flex items-center justify-center gap-2 py-2 rounded-xl border transition-all font-bold text-xs"
                      :class="
                        activeAxis === 'y'
                          ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20'
                          : 'bg-background border-border text-muted-foreground hover:border-primary/40'
                      "
                    >
                      水平线 (Y)
                    </button>
                  </div>
                </div>
                <AppTip variant="info" class="text-[0.6rem] py-2 border-primary/10"
                  >点击图片添加切线，拖拽移动，双击删除。</AppTip
                >
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
                  { label: '标准切分', value: 'none', icon: Grid3X3 },
                  { label: '自动居中', value: 'center', icon: AlignCenter },
                  { label: '补全正方形', value: 'square', icon: Box }
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
                <AppTip variant="info" class="text-[0.6rem] py-2"
                  >居中模式会自动识别背景并重新对齐内容。</AppTip
                >
              </div>
            </div>
          </section>
          <section class="space-y-5">
            <AppSectionHeader title="导出配置" :icon="FileType" />
            <div class="space-y-4 px-1">
              <AppSelect
                v-model="outputFormat"
                :options="[
                  { label: '保留原格式', value: 'original' },
                  { label: 'WebP (推荐)', value: 'image/webp' },
                  { label: 'JPEG (高兼容)', value: 'image/jpeg' },
                  { label: 'PNG (无损)', value: 'image/png' }
                ]"
              />
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
            <span class="font-bold tracking-tight text-base">{{
              isProcessing ? '正在处理...' : '执行智能切图'
            }}</span>
          </AppButton>
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>

<style scoped>
.transparency-grid {
  background-image: conic-gradient(
    hsl(var(--muted-foreground) / 0.1) 0 25%,
    transparent 0 50%,
    hsl(var(--muted-foreground) / 0.1) 0 75%,
    transparent 0
  );
  background-size: 16px 16px;
}
.shadow-elevated {
  box-shadow: 0 8px 30px -10px rgba(0, 0, 0, 0.15);
}
.custom-scrollbar::-webkit-scrollbar {
  height: 4px;
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 10px;
}
</style>
