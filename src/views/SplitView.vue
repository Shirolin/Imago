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
import {
  Scissors,
  Grid3X3,
  Layers,
  Box,
  AlignCenter,
  Trash2,
  Download,
  RotateCcw
} from 'lucide-vue-next'
import { splitEngine } from '../lib/engines/splitEngine'
import type { ViewSettings } from '../lib/engines/types'
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

const viewSettings = ref<ViewSettings>({
  lineWidth: 1.5,
  lineColor: 'white',
  lineOpacity: 0.95
})
const colorOptions = [
  { value: 'primary', label: '主题色', color: 'primary' },
  { value: 'white', label: '高亮白 (默认)', color: '#ffffff' },
  { value: 'black', label: '深邃黑', color: '#000000' },
  { value: 'blue', label: '科技蓝', color: '#3b82f6' },
  { value: 'red', label: '警示红', color: '#ef4444' }
] as const

const resetViewSettings = () => {
  viewSettings.value = {
    lineWidth: 1.5,
    lineColor: 'white',
    lineOpacity: 0.95
  }
  srMessage.value = '已恢复默认视图设置'
}

const colorButtonRefs = ref<HTMLElement[]>([])

const handleColorKeydown = (e: KeyboardEvent) => {
  const index = colorOptions.findIndex((c) => c.value === viewSettings.value.lineColor)
  let nextIndex = index

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    nextIndex = (index + 1) % colorOptions.length
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    nextIndex = (index - 1 + colorOptions.length) % colorOptions.length
  } else {
    return
  }

  e.preventDefault()
  viewSettings.value.lineColor = colorOptions[nextIndex]!.value
  nextTick(() => {
    colorButtonRefs.value[nextIndex]?.focus()
  })
}

// 【新】：触感反馈
const triggerHaptic = (intensity = 5) => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(intensity)
  }
}

let lastLoadId = 0

const { isProcessing, progress, processSingle, abortProcessing } = useImageProcessor(splitEngine)
const selectedImage = computed(() => store.activeImage)

const isAborting = ref(false)

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

let themeObserver: MutationObserver | null = null

const updateThemeColor = () => {
  const root = document.documentElement
  const colorPrimary = getComputedStyle(root).getPropertyValue('--primary').trim()
  if (colorPrimary) {
    const newColor = colorPrimary.includes('hsl') ? colorPrimary : `hsl(${colorPrimary})`
    if (newColor !== cachedPrimaryColor) {
      cachedPrimaryColor = newColor
      requestDraw()
    }
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

    updateThemeColor()
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
    const isActive = isHovered || isDragging || isSelected
    const { lineWidth, lineColor, lineOpacity } = viewSettings.value

    // 1. 绘制底层：高对比度黑边 (确保在浅色背景可见)
    ctx.beginPath()
    ctx.lineWidth = (isActive ? lineWidth * 2.5 : lineWidth * 2) / scale
    ctx.strokeStyle = `rgba(0, 0, 0, ${lineOpacity * 0.4})`

    if (isVertical) {
      ctx.moveTo(pos, 0)
      ctx.lineTo(pos, img.height!)
    } else {
      ctx.moveTo(0, pos)
      ctx.lineTo(img.width!, pos)
    }
    ctx.stroke()

    // 2. 绘制顶层：核心线
    ctx.beginPath()
    ctx.lineWidth = (isActive ? lineWidth * 1.5 : lineWidth) / scale

    // 颜色映射逻辑
    let coreColor = 'rgba(255, 255, 255, 0.95)'
    if (isActive) {
      coreColor = activeColor
    } else {
      if (lineColor === 'primary') coreColor = activeColor
      else if (lineColor === 'blue') coreColor = '#3b82f6'
      else if (lineColor === 'red') coreColor = '#ef4444'
      else if (lineColor === 'black') coreColor = 'rgba(0, 0, 0, 0.95)'
      else coreColor = `rgba(255, 255, 255, ${lineOpacity})`
    }

    ctx.strokeStyle = coreColor

    // 激活态增加外发光
    if (isActive) {
      ctx.shadowBlur = 10 / scale
      ctx.shadowColor = isDragging || isSelected ? activeColor : 'rgba(0, 0, 0, 0.5)'
    }

    if (isVertical) {
      ctx.moveTo(pos, 0)
      ctx.lineTo(pos, img.height!)
    } else {
      ctx.moveTo(0, pos)
      ctx.lineTo(img.width!, pos)
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

// 监听绘制相关的状态 (细化监听以提升性能)
watch(
  [rows, cols, editMode, linesX, linesY, hoveredLine, draggingLine, selectedLine],
  requestDraw,
  { deep: true }
)

// 【极致性能优化】：仅监听视图设置中的具体原子属性，避免闭包内对象解构的内存开销
watch(
  [
    () => viewSettings.value.lineWidth,
    () => viewSettings.value.lineColor,
    () => viewSettings.value.lineOpacity
  ],
  () => requestDraw()
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
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
  if (!selectedLine.value || !selectedImage.value) return

  const { axis, index } = selectedLine.value

  // 【新】：支持 Delete/Backspace 删除选中的线
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (axis === 'x') linesX.value.splice(index, 1)
    else linesY.value.splice(index, 1)
    srMessage.value = `已通过键盘删除第 ${index + 1} 条${axis === 'x' ? '垂直' : '水平'}线`
    selectedLine.value = null
    saveMeta()
    e.preventDefault()
    return
  }

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

  // 【极致性能优化】：被动观察主题变化，而非在渲染循环中轮询 DOM
  themeObserver = new MutationObserver(() => {
    updateThemeColor()
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-theme']
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (themeObserver) {
    themeObserver.disconnect()
    themeObserver = null
  }
  // 【性能优化】：显式释放离屏 Canvas 显存
  if (offscreenCanvas) {
    offscreenCanvas.width = offscreenCanvas.height = 0
    offscreenCanvas = null
  }
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
  if (!img) return { pos, snapped: false }
  const max = axis === 'x' ? img.width! : img.height!
  const scale = workspaceRef.value?.scale || 1
  const threshold = 15 / scale

  // 吸附到边缘
  if (pos < threshold) return { pos: 0, snapped: true }
  if (Math.abs(pos - max) < threshold) return { pos: max, snapped: true }

  // 吸附到中点
  if (Math.abs(pos - max / 2) < threshold) return { pos: max / 2, snapped: true }

  return { pos, snapped: false }
}

const handlePointerDown = (e: PointerEvent) => {
  if (isHandMode.value || workspaceRef.value?.isPanning || e.button !== 0 || e.altKey) return

  const img = selectedImage.value
  if (!img) return

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
    triggerHaptic(10) // 选中反馈
    return
  }

  // 没点中线，取消选中
  selectedLine.value = null

  if (editMode.value === 'custom') {
    if (activeAxis.value === 'x') {
      const { pos: snappedX, snapped } = snapLine(pos.x, 'x')
      linesX.value.push(snappedX)
      linesX.value.sort((a, b) => a - b)
      srMessage.value = `已在垂直方向 ${Math.round(snappedX)} 像素处添加切分线`
      // 自动选中新添加的线
      const newIndex = linesX.value.indexOf(snappedX)
      selectedLine.value = { axis: 'x', index: newIndex }
      if (snapped) triggerHaptic(8)
    } else {
      const { pos: snappedY, snapped } = snapLine(pos.y, 'y')
      linesY.value.push(snappedY)
      linesY.value.sort((a, b) => a - b)
      srMessage.value = `已在水平方向 ${Math.round(snappedY)} 像素处添加切分线`
      // 自动选中新添加的线
      const newIndex = linesY.value.indexOf(snappedY)
      selectedLine.value = { axis: 'y', index: newIndex }
      if (snapped) triggerHaptic(8)
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
    const currentLines = axis === 'x' ? linesX.value : linesY.value
    const oldVal = currentLines[index]
    const { pos: newVal, snapped } = snapLine(axis === 'x' ? pos.x : pos.y, axis)

    if (axis === 'x') linesX.value[index] = newVal
    else linesY.value[index] = newVal

    // 仅在吸附瞬间触发一次反馈
    if (snapped && oldVal !== newVal) {
      triggerHaptic(5)
    }
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
  srMessage.value = '已根据网格设置数值重置线条位置'
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

  if (isAborting.value) {
    return { text: '已中止', icon: RotateCcw, action: 'none', disabled: true }
  }

  if (isProcessing.value) {
    const progressText =
      progress.value > 0 ? `渲染中 ${Math.round(progress.value * 100)}%` : '渲染中...'
    return {
      text: `${progressText} (点击中止)`,
      icon: Trash2,
      action: 'abort',
      disabled: false
    }
  }

  if (img.status === 'done' && (img.processedBlob || img.processedBlobs) && !img.isDirty) {
    return { text: '导出切片', icon: Download, action: 'download', disabled: false }
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

  if (state.action === 'abort') {
    isAborting.value = true
    abortProcessing()
    srMessage.value = '已中止渲染任务'
    setTimeout(() => {
      isAborting.value = false
    }, 800)
    return
  }

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
        aria-label="图片分割画布"
        :aria-describedby="'canvas-instructions'"
        @reset="resetView"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointerleave="handlePointerUp"
        @pointercancel="handlePointerUp"
      >
        <template #default>
          <!-- 隐藏的 A11y 指引文本 -->
          <div id="canvas-instructions" class="sr-only">
            使用鼠标点击添加切分线。按住空格键并拖拽可以平移画布。
            选中线条后，使用方向键进行像素级微调，Shift + 方向键快速移动，Delete 或 Backspace
            键删除选中线。
          </div>
          <div class="relative shadow-2xl">
            <canvas ref="canvasRef" class="block rounded-sm" />

            <!-- 【无障碍层】：物理焦点锚点 -->
            <div class="absolute inset-0 pointer-events-none overflow-hidden">
              <!-- 垂直线焦点 -->
              <button
                v-for="(lx, i) in linesX"
                :key="`focus-x-${i}`"
                class="absolute top-0 bottom-0 w-4 -ml-2 pointer-events-auto opacity-0 focus:opacity-100 focus:bg-primary/20 focus:ring-2 focus:ring-primary/40 focus:outline-none transition-all z-20 cursor-col-resize"
                :style="{ left: `${lx}px` }"
                tabindex="0"
                @focus="selectedLine = { axis: 'x', index: i }"
                @blur="selectedLine = null"
                :aria-label="`垂直切分线 ${i + 1}，当前位置 ${Math.round(lx)} 像素`"
              />
              <!-- 水平线焦点 -->
              <button
                v-for="(ly, i) in linesY"
                :key="`focus-y-${i}`"
                class="absolute left-0 right-0 h-4 -mt-2 pointer-events-auto opacity-0 focus:opacity-100 focus:bg-primary/20 focus:ring-2 focus:ring-primary/40 focus:outline-none transition-all z-20 cursor-row-resize"
                :style="{ top: `${ly}px` }"
                tabindex="0"
                @focus="selectedLine = { axis: 'y', index: i }"
                @blur="selectedLine = null"
                :aria-label="`水平切分线 ${i + 1}，当前位置 ${Math.round(ly)} 像素`"
              />
            </div>
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
              <AppSlider
                v-model="rows"
                label="垂直行数"
                :icon="AlignCenter"
                unit=" 行"
                :min="1"
                :max="10"
                :step="1"
                :default-value="3"
              />
            </div>
            <div class="space-y-1">
              <AppSlider
                v-model="cols"
                label="水平列数"
                :icon="Grid3X3"
                unit=" 列"
                :min="1"
                :max="10"
                :step="1"
                :default-value="3"
              />
            </div>
          </div>
          <div
            v-else
            class="bg-primary/5 rounded-2xl p-4 border border-primary/20 flex flex-col gap-4"
          >
            <div class="grid grid-cols-2 gap-3">
              <AppButton
                @click="activeAxis = 'x'"
                :variant="activeAxis === 'x' ? 'primary' : 'secondary'"
                size="md"
                class="rounded-xl h-11 border-2 text-xs"
                :class="{ 'border-primary shadow-md': activeAxis === 'x' }"
              >
                垂直线
              </AppButton>
              <AppButton
                @click="activeAxis = 'y'"
                :variant="activeAxis === 'y' ? 'primary' : 'secondary'"
                size="md"
                class="rounded-xl h-11 border-2 text-xs"
                :class="{ 'border-primary shadow-md': activeAxis === 'y' }"
              >
                水平线
              </AppButton>
            </div>
            <div class="flex gap-2.5">
              <AppButton
                @click="handleResetToGrid"
                variant="secondary"
                size="sm"
                class="flex-1 rounded-xl h-10 text-[11px] font-black uppercase tracking-widest border-border/40 bg-muted/5"
                :icon="Grid3X3"
                title="根据网格设置数值重置线条"
              >
                同步网格
              </AppButton>
              <AppButton
                @click="clearLines"
                variant="secondary"
                size="sm"
                class="flex-1 rounded-xl h-10 text-[11px] font-black uppercase tracking-widest border-border/40 bg-muted/5 hover:text-destructive hover:border-destructive hover:bg-destructive/5"
                :icon="Trash2"
              >
                全部清空
              </AppButton>
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-5">
        <div class="flex items-center justify-between pr-1">
          <AppSectionHeader title="视图设置" :icon="Box" />
          <AppButton
            variant="ghost"
            size="sm"
            @click="resetViewSettings"
            class="w-8 h-8 p-0 rounded-lg text-muted-foreground/40 hover:text-primary"
            title="恢复默认视图"
            :icon="RotateCcw"
          />
        </div>
        <div class="space-y-4 px-1">
          <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-6">
            <div class="space-y-1">
              <AppSlider
                v-model="viewSettings.lineWidth"
                label="线宽"
                :icon="Scissors"
                unit="px"
                :min="0.5"
                :max="5"
                :step="0.1"
                :default-value="1.5"
              />
            </div>

            <div class="space-y-3">
              <span
                id="line-color-label"
                class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block px-1"
                >线条颜色</span
              >
              <div
                class="grid grid-cols-4 gap-2"
                role="radiogroup"
                aria-labelledby="line-color-label"
                @keydown="handleColorKeydown"
              >
                <button
                  v-for="c in colorOptions"
                  :key="c.value"
                  @click="viewSettings.lineColor = c.value"
                  class="h-8 rounded-lg border-2 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none active:scale-95"
                  :class="
                    viewSettings.lineColor === c.value
                      ? 'border-primary ring-2 ring-primary/20 shadow-sm'
                      : 'border-transparent bg-muted/20 hover:bg-muted/40'
                  "
                  :title="c.label"
                  role="radio"
                  :aria-checked="viewSettings.lineColor === c.value"
                  :aria-label="c.label"
                  :tabindex="viewSettings.lineColor === c.value ? 0 : -1"
                  data-color-option
                >
                  <div
                    class="w-4 h-4 rounded-full border border-black/10"
                    :style="{
                      backgroundColor: c.value === 'primary' ? cachedPrimaryColor : c.color
                    }"
                  ></div>
                </button>
              </div>
            </div>

            <div class="space-y-1">
              <AppSlider
                v-model="viewSettings.lineOpacity"
                label="不透明度"
                :icon="Layers"
                unit=""
                :min="0.1"
                :max="1"
                :step="0.05"
                :default-value="0.95"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-5">
        <AppSectionHeader title="增强处理" :icon="Layers" />
        <div class="space-y-6 px-1">
          <div class="space-y-4">
            <div class="flex flex-col gap-1 px-1">
              <span class="text-[10px] font-black text-muted-foreground uppercase tracking-widest"
                >对齐模式</span
              >
              <p class="text-[10px] text-muted-foreground/60 leading-relaxed">
                自动探测并裁剪主体内容，支持居中对齐或强制正方形填充。
              </p>
            </div>
            <AppSegmentedControl
              v-model="centerMode"
              :options="[
                { label: '标准', value: 'none', icon: Grid3X3 },
                { label: '居中', value: 'center', icon: AlignCenter },
                { label: '正方形', value: 'square', icon: Box }
              ]"
            />
          </div>

          <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-5">
            <div class="space-y-1">
              <AppSlider
                v-model="shave"
                label="边缘收缩 (Shave)"
                :icon="Box"
                unit="px"
                :min="0"
                :max="50"
                :step="1"
                :default-value="0"
              />
            </div>
          </div>
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
          :variant="ctaState.action === 'download' ? 'success' : 'cta'"
          class="w-full h-12 rounded-xl shadow-lg transition-all duration-500 active:scale-95 group overflow-hidden"
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
.fade-fast-enter-active {
  transition:
    opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-fast-leave-active {
  transition:
    opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-fast-enter-from,
.fade-fast-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);
}
</style>
