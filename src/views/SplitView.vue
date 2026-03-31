<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import AppCanvasWorkspace from '../components/common/AppCanvasWorkspace.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import { Scissors, Grid3X3, Layers, Box, AlignCenter, Trash2, Download } from 'lucide-vue-next'
import { splitEngine } from '../lib/engines/splitEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useResizeObserver } from '@vueuse/core'
import { useBreakpoints } from '../composables/useBreakpoints'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const { downloadImage } = useFileHelpers()
const { isMobile } = useBreakpoints()

// 状态
const rows = ref(3)
const cols = ref(3)
const centerMode = ref<'none' | 'center' | 'square'>('none')
const shave = ref(0)
const outputFormat = ref<string>('original')
const outputQuality = ref(0.9)

let lastLoadId = 0

const { isProcessing, processSingle } = useImageProcessor(splitEngine)
const selectedImage = computed(() => store.activeImage)

// 使用通用 Canvas 逻辑
const workspaceRef = ref<InstanceType<typeof AppCanvasWorkspace> | null>(null)
const containerRef = computed(() => workspaceRef.value?.containerRef)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const isHandMode = computed(() => workspaceRef.value?.isHandMode || false)

const editMode = ref<'grid' | 'custom'>('grid')
const activeAxis = ref<'x' | 'y'>('x')
const draggingLine = ref<{ axis: 'x' | 'y'; index: number } | null>(null)
const hoveredLine = ref<{ axis: 'x' | 'y'; index: number } | null>(null)
// 【新】：选中的线，用于键盘操作
const selectedLine = ref<{ axis: 'x' | 'y'; index: number } | null>(null)
const isAltPressed = ref(false)

const linesX = ref<number[]>([])
const linesY = ref<number[]>([])

// 无障碍播报
const srMessage = ref('')

let offscreenCanvas: HTMLCanvasElement | null = null
let cachedPrimaryColor = 'hsl(215, 100%, 50%)' // 默认值

let isDrawingRaf = false

const updateThemeColor = () => {
  const colorPrimary = getComputedStyle(document.documentElement)
    .getPropertyValue('--primary')
    .trim()
  if (colorPrimary) {
    cachedPrimaryColor = `hsl(${colorPrimary})`
  }
}

const updateCachedImage = () => {
  const imgData = selectedImage.value
  if (!imgData) {
    offscreenCanvas = null
    return
  }
  const loadId = ++lastLoadId
  const img = new Image()
  img.src = imgData.preview
  img.onload = () => {
    if (loadId !== lastLoadId) return
    offscreenCanvas = document.createElement('canvas')
    offscreenCanvas.width = imgData.width!
    offscreenCanvas.height = imgData.height!
    const octx = offscreenCanvas.getContext('2d')
    octx?.drawImage(img, 0, 0)
    requestDraw()
    nextTick(resetView)
  }
}

const draw = () => {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  const img = selectedImage.value
  const scale = workspaceRef.value?.scale || 1
  if (!canvas || !ctx || !offscreenCanvas || !img) return
  canvas.width = img.width!
  canvas.height = img.height!
  ctx.clearRect(0, 0, img.width!, img.height!)
  ctx.drawImage(offscreenCanvas, 0, 0)

  const drawStylizedLine = (
    pos: number,
    isVertical: boolean,
    isHovered: boolean,
    isDragging: boolean,
    isSelected: boolean
  ) => {
    ctx.save()
    const activeColor = cachedPrimaryColor

    // 辅助阴影
    ctx.beginPath()
    ctx.lineWidth = (isHovered || isDragging || isSelected ? 3 : 2) / scale
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    if (isVertical) {
      ctx.moveTo(pos + 1 / scale, 0)
      ctx.lineTo(pos + 1 / scale, img.height!)
    } else {
      ctx.moveTo(0, pos + 1 / scale)
      ctx.lineTo(img.width!, pos + 1 / scale)
    }
    ctx.stroke()

    // 主线条
    ctx.beginPath()
    ctx.lineWidth = (isHovered || isDragging ? 2.5 : isSelected ? 3 : 1.5) / scale
    ctx.strokeStyle =
      isDragging || isSelected ? activeColor : isHovered ? activeColor : 'rgba(255,255,255,0.8)'

    if (isVertical) {
      ctx.moveTo(pos, 0)
      ctx.lineTo(pos, img.height!)
    } else {
      ctx.moveTo(0, pos)
      ctx.lineTo(img.width!, pos)
    }

    if (isHovered || isDragging || isSelected) {
      ctx.shadowBlur = 12 / scale
      ctx.shadowColor = activeColor
    }
    ctx.stroke()
    ctx.restore()
  }

  // 绘制网格线 (均分模式)
  if (editMode.value === 'grid') {
    for (let i = 1; i < cols.value; i++) {
      drawStylizedLine((img.width! / cols.value) * i, true, false, false, false)
    }
    for (let i = 1; i < rows.value; i++) {
      drawStylizedLine((img.height! / rows.value) * i, false, false, false, false)
    }
  } else {
    // 绘制自定义线 (自由模式)
    linesX.value.forEach((lx, i) =>
      drawStylizedLine(
        lx,
        true,
        hoveredLine.value?.axis === 'x' && hoveredLine.value.index === i,
        draggingLine.value?.axis === 'x' && draggingLine.value.index === i,
        selectedLine.value?.axis === 'x' && selectedLine.value.index === i
      )
    )
    linesY.value.forEach((ly, i) =>
      drawStylizedLine(
        ly,
        false,
        hoveredLine.value?.axis === 'y' && hoveredLine.value.index === i,
        draggingLine.value?.axis === 'y' && draggingLine.value.index === i,
        selectedLine.value?.axis === 'y' && selectedLine.value.index === i
      )
    )
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

// 监听绘制相关的状态
watch(
  [rows, cols, editMode, linesX, linesY, hoveredLine, draggingLine, selectedLine],
  requestDraw,
  {
    deep: true
  }
)

const resetView = () => {
  const img = selectedImage.value
  if (!img) return
  workspaceRef.value?.triggerAutoFit(img.width!, img.height!)
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
    store.markDirty(selectedImage.value.id)
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (!selectedLine.value || !selectedImage.value) return

  const { axis, index } = selectedLine.value
  const step = e.shiftKey ? 10 : 1
  const max = axis === 'x' ? selectedImage.value.width! : selectedImage.value.height!

  if (axis === 'x') {
    if (e.key === 'ArrowLeft') linesX.value[index] = Math.max(0, linesX.value[index]! - step)
    else if (e.key === 'ArrowRight')
      linesX.value[index] = Math.min(max, linesX.value[index]! + step)
    else return
  } else {
    if (e.key === 'ArrowUp') linesY.value[index] = Math.max(0, linesY.value[index]! - step)
    else if (e.key === 'ArrowDown') linesY.value[index] = Math.min(max, linesY.value[index]! + step)
    else return
  }

  e.preventDefault()
  saveMeta()
}

onMounted(() => {
  updateThemeColor()
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

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
      // 默认清空
      linesX.value = []
      linesY.value = []
    }
    selectedLine.value = null
    nextTick(resetView)
  },
  { immediate: true }
)

const getLogicPos = (e: PointerEvent) => {
  if (!canvasRef.value) return { x: 0, y: 0 }
  const rect = canvasRef.value.getBoundingClientRect()
  const scale = workspaceRef.value?.scale || 1
  return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale }
}

const snapLine = (pos: number, axis: 'x' | 'y') => {
  const img = selectedImage.value
  if (!img) return pos
  const max = axis === 'x' ? img.width! : img.height!
  const scale = workspaceRef.value?.scale || 1
  const threshold = 15 / scale

  // 吸附到边缘
  if (pos < threshold) return 0
  if (Math.abs(pos - max) < threshold) return max

  // 吸附到中点
  if (Math.abs(pos - max / 2) < threshold) return max / 2

  return pos
}

const handlePointerDown = (e: PointerEvent) => {
  if (isHandMode.value || workspaceRef.value?.isPanning || e.button !== 0 || e.altKey) return

  const img = selectedImage.value
  if (!img) return

  // 【优化】：检测点击。移动端增加判定范围（24px），桌面端保持 12px
  const scale = workspaceRef.value?.scale || 1
  const hitThreshold = (e.pointerType === 'touch' ? 24 : 12) / scale
  const pos = getLogicPos(e)

  // 无论在什么模式，只要点中了线，就准备拖拽
  if (hoveredLine.value) {
    // 如果是在 Grid 模式点中的，先执行转换
    if (editMode.value === 'grid') {
      const newLinesX: number[] = []
      const newLinesY: number[] = []
      for (let i = 1; i < cols.value; i++) newLinesX.push((img.width! / cols.value) * i)
      for (let i = 1; i < rows.value; i++) newLinesY.push((img.height! / rows.value) * i)
      linesX.value = newLinesX
      linesY.value = newLinesY
      editMode.value = 'custom'
      srMessage.value = '已切换至自由编辑模式'
    }
    draggingLine.value = { ...hoveredLine.value }
    selectedLine.value = { ...hoveredLine.value } // 选中线以支持键盘操作
    return
  }

  // 没点中线，取消选中
  selectedLine.value = null

  if (editMode.value === 'custom') {
    if (activeAxis.value === 'x') {
      const snappedX = snapLine(pos.x, 'x')
      linesX.value.push(snappedX)
      linesX.value.sort((a, b) => a - b)
      srMessage.value = `已在垂直方向 ${Math.round(snappedX)} 像素处添加切分线`
      // 自动选中新添加的线
      const newIndex = linesX.value.indexOf(snappedX)
      selectedLine.value = { axis: 'x', index: newIndex }
    } else {
      const snappedY = snapLine(pos.y, 'y')
      linesY.value.push(snappedY)
      linesY.value.sort((a, b) => a - b)
      srMessage.value = `已在水平方向 ${Math.round(snappedY)} 像素处添加切分线`
      // 自动选中新添加的线
      const newIndex = linesY.value.indexOf(snappedY)
      selectedLine.value = { axis: 'y', index: newIndex }
    }
    saveMeta()
  }
}

const handlePointerMove = (e: PointerEvent) => {
  if (workspaceRef.value?.isPanning || isHandMode.value) {
    hoveredLine.value = null
    return
  }
  const pos = getLogicPos(e)
  isAltPressed.value = e.altKey

  if (draggingLine.value) {
    const { axis, index } = draggingLine.value
    if (axis === 'x') linesX.value[index] = snapLine(pos.x, 'x')
    else linesY.value[index] = snapLine(pos.y, 'y')
    return
  }

  const scale = workspaceRef.value?.scale || 1
  // 【优化】：移动端判定半径扩大
  const threshold = (e.pointerType === 'touch' ? 20 : 12) / scale
  const img = selectedImage.value
  let found = false

  // 【核心增强】：支持检测 Grid 模式下的虚拟线
  const checkLinesX =
    editMode.value === 'custom'
      ? linesX.value
      : img
        ? Array.from({ length: cols.value - 1 }, (_, i) => (img.width! / cols.value) * (i + 1))
        : []

  const checkLinesY =
    editMode.value === 'custom'
      ? linesY.value
      : img
        ? Array.from({ length: rows.value - 1 }, (_, i) => (img.height! / rows.value) * (i + 1))
        : []

  for (let i = 0; i < checkLinesX.length; i++) {
    if (Math.abs(pos.x - checkLinesX[i]!) < threshold) {
      hoveredLine.value = { axis: 'x', index: i }
      found = true
      break
    }
  }
  if (!found) {
    for (let i = 0; i < checkLinesY.length; i++) {
      if (Math.abs(pos.y - checkLinesY[i]!) < threshold) {
        hoveredLine.value = { axis: 'y', index: i }
        found = true
        break
      }
    }
  }

  // 更新光标反馈
  if (workspaceRef.value?.containerRef) {
    const container = workspaceRef.value.containerRef
    if (found) {
      container.style.cursor = hoveredLine.value?.axis === 'x' ? 'col-resize' : 'row-resize'
    } else {
      container.style.cursor = ''
    }
  }

  if (!found) hoveredLine.value = null
}

const handlePointerUp = (e: PointerEvent) => {
  if (draggingLine.value) {
    const { axis, index } = draggingLine.value
    const pos = getLogicPos(e)
    const img = selectedImage.value
    if (img) {
      const max = axis === 'x' ? img.width! : img.height!
      const val = axis === 'x' ? pos.x : pos.y
      const scale = workspaceRef.value?.scale || 1
      const outThreshold = 30 / scale // 拖离边界 30 像素则删除

      if (val < -outThreshold || val > max + outThreshold) {
        if (axis === 'x') linesX.value.splice(index, 1)
        else linesY.value.splice(index, 1)
        srMessage.value = `已删除第 ${index + 1} 条${axis === 'x' ? '垂直' : '水平'}线`
      }
    }
    draggingLine.value = null
    saveMeta()
  }
}

const handleResetToGrid = () => {
  const img = selectedImage.value
  if (!img) return
  const newLinesX: number[] = []
  const newLinesY: number[] = []
  for (let i = 1; i < cols.value; i++) newLinesX.push((img.width! / cols.value) * i)
  for (let i = 1; i < rows.value; i++) newLinesY.push((img.height! / rows.value) * i)
  linesX.value = newLinesX
  linesY.value = newLinesY
  srMessage.value = '已根据当前网格重置线条位置'
  saveMeta()
}

const clearLines = () => {
  linesX.value = []
  linesY.value = []
  srMessage.value = '已清空所有自定义切分线'
  saveMeta()
}

watch(
  [rows, cols, editMode, centerMode, shave, outputFormat, outputQuality],
  () => {
    if (selectedImage.value) store.markDirty(selectedImage.value.id)
  },
  { deep: true }
)

const handleApplyProcess = async () => {
  if (!selectedImage.value) return
  await processSingle(selectedImage.value.id, {
    rows: editMode.value === 'custom' ? linesY.value.length + 1 : rows.value,
    cols: editMode.value === 'custom' ? linesX.value.length + 1 : cols.value,
    mode: editMode.value,
    customLines:
      editMode.value === 'custom' ? { x: [...linesX.value], y: [...linesY.value] } : undefined,
    centerMode: centerMode.value,
    shave: shave.value,
    format: outputFormat.value === 'original' ? undefined : outputFormat.value,
    quality: outputQuality.value
  })
}

useResizeObserver(containerRef, resetView)

const ctaState = computed(() => {
  const img = selectedImage.value
  if (!img) return { text: '请选择图片', icon: Scissors, action: 'none', disabled: true }

  if (isProcessing.value) {
    return { text: '渲染中...', icon: Scissors, action: 'none', disabled: true }
  }

  if (img.status === 'done' && (img.processedBlob || img.processedBlobs) && !img.isDirty) {
    return { text: '下载切片', icon: Download, action: 'download', disabled: false }
  }

  return {
    text: img.isDirty ? '更新切分' : '切分图片',
    icon: Scissors,
    action: 'process',
    disabled: false
  }
})

const handleCtaClick = async () => {
  const state = ctaState.value
  if (state.action === 'none') return

  if (state.action === 'download') {
    const img = selectedImage.value
    if (img && (img.processedBlob || img.processedBlobs)) {
      downloadImage(img.processedBlobs || img.processedBlob!, img.file.name, '_Split')
    }
    return
  }

  if (state.action === 'process') {
    await handleApplyProcess()
  }
}
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
    <template #header-left><ImageSelectionStatus :show-card-size="false" /></template>
    <template #header-actions
      ><ImageActionsToolbar :is-processing="isProcessing" :show-download-all="false" show-clear-all
    /></template>

    <template #content>
      <!-- 无障碍实时播报 -->
      <div class="sr-only" aria-live="polite">{{ srMessage }}</div>
      <AppCanvasWorkspace
        ref="workspaceRef"
        @reset="resetView"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointerleave="handlePointerUp"
        @pointercancel="handlePointerUp"
      >
        <template #default>
          <div class="relative shadow-2xl">
            <canvas ref="canvasRef" class="block rounded-sm" />
          </div>
        </template>

        <!-- 【优化】：调整位置到底部中心，避开图片主体，并适配移动端托盘高度 -->
        <template #floating>
          <Transition name="fade-fast">
            <div
              v-if="editMode === 'custom' && !draggingLine"
              class="absolute left-1/2 -translate-x-1/2 bg-background/60 backdrop-blur-md px-4 py-2 rounded-2xl text-foreground text-[10px] font-bold border border-border/40 pointer-events-none shadow-lg z-50 whitespace-nowrap tracking-wider flex items-center gap-2 transition-all duration-500"
              :class="[isMobile ? 'bottom-[140px]' : 'bottom-24']"
            >
              <div
                class="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary"
              >
                <Scissors :size="12" />
              </div>
              <span>点击画布添加线 <span class="mx-1 opacity-40">·</span> 拖拽线条移动</span>
            </div>
          </Transition>
        </template>
      </AppCanvasWorkspace>
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
            <div class="space-y-1">
              <div class="flex justify-between items-center px-1">
                <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
                  >垂直行数</span
                >
                <span class="text-xs font-mono font-bold text-primary">{{ rows }}</span>
              </div>
              <AppSlider v-model="rows" :min="1" :max="10" :step="1" />
            </div>
            <div class="space-y-1">
              <div class="flex justify-between items-center px-1">
                <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
                  >水平列数</span
                >
                <span class="text-xs font-mono font-bold text-primary">{{ cols }}</span>
              </div>
              <AppSlider v-model="cols" :min="1" :max="10" :step="1" />
            </div>
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
            <div class="flex gap-2">
              <button
                @click="handleResetToGrid"
                class="flex-1 py-2.5 rounded-xl border border-border/40 bg-muted/5 hover:bg-primary/5 hover:border-primary/40 transition-all text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 text-muted-foreground/60"
                title="根据左侧滑块数值重置线条"
              >
                <Grid3X3 :size="13" /> 同步网格
              </button>
              <button
                @click="clearLines"
                class="flex-1 py-2.5 rounded-xl border border-border/40 bg-muted/5 hover:bg-destructive/5 hover:border-destructive hover:text-destructive transition-all text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 text-muted-foreground/60"
              >
                <Trash2 :size="13" /> 全部清空
              </button>
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
        </div>
      </section>

      <AppExportSettings
        v-model:format="outputFormat"
        v-model:quality="outputQuality"
        title="导出配置"
        class="pb-4"
      />
    </template>

    <template #footer>
      <InspectorFooter>
        <AppButton
          size="lg"
          variant="cta"
          class="w-full h-12 rounded-xl shadow-xl transition-all duration-500 active:scale-95 group overflow-hidden"
          :class="[
            ctaState.action === 'download'
              ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-400/20 shadow-emerald-500/20 text-white'
              : 'shadow-primary/10'
          ]"
          :loading="isProcessing"
          :disabled="ctaState.disabled"
          @click="handleCtaClick"
        >
          <template #icon>
            <component :is="ctaState.icon" v-if="!isProcessing" :size="18" class="mr-2" />
          </template>
          <span class="font-bold text-sm tracking-tight">{{ ctaState.text }}</span>
        </AppButton>
      </InspectorFooter>
    </template>
  </WorkspaceLayout>
</template>

<style scoped>
.fade-fast-enter-active,
.fade-fast-leave-active {
  transition:
    opacity 0.2s ease-out,
    transform 0.2s ease-out;
}
.fade-fast-enter-from,
.fade-fast-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px);
}
</style>
