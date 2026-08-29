<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
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
import AppModal from '../components/common/AppModal.vue'
import {
  Scissors,
  Grid3X3,
  Layers,
  Box,
  AlignCenter,
  Trash2,
  Download,
  RotateCcw,
  AlertCircle,
  Loader2
} from 'lucide-vue-next'
import { splitEngine } from '../lib/engines/splitEngine'
import type { ViewSettings, ProcessResult } from '../lib/engines/types'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useResizeObserver } from '@vueuse/core'
import { useBreakpoints } from '../composables/useBreakpoints'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const { t } = useI18n()
const store = useImageStore()
const { downloadImage } = useFileHelpers()
const { isMobile } = useBreakpoints()

// 本地结果存储
interface LocalResult {
  blobs: Blob[]
  isDirty: boolean
}
const results = ref<Map<string, LocalResult>>(new Map())

const cleanupResults = () => {
  results.value.clear()
}

onUnmounted(() => {
  cleanupResults()
})

// 监听图片列表变化，自动清理已删除图片的本地结果
watch(
  () => store.images,
  (newImages) => {
    const currentIds = new Set(newImages.map((img) => img.id))
    results.value.forEach((_res, id) => {
      if (!currentIds.has(id)) {
        results.value.delete(id)
      }
    })

    if (newImages.length === 0) {
      linesX.value = []
      linesY.value = []
      selectedLine.value = null
    }
  },
  { deep: true }
)

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
const colorOptions = computed(() => [
  { value: 'primary' as const, label: t('tools.split.colors.primary'), color: 'primary' },
  { value: 'white' as const, label: t('tools.split.colors.white'), color: '#ffffff' },
  { value: 'black' as const, label: t('tools.split.colors.black'), color: '#000000' },
  { value: 'blue' as const, label: t('tools.split.colors.blue'), color: '#3b82f6' },
  { value: 'red' as const, label: t('tools.split.colors.red'), color: '#ef4444' }
])

// 确认框状态
const showResetConfirm = ref(false)
const resetType = ref<'grid' | 'view'>('grid')

const handleResetToGrid = () => {
  resetType.value = 'grid'
  showResetConfirm.value = true
}

const resetViewSettings = () => {
  resetType.value = 'view'
  showResetConfirm.value = true
}

const confirmResetSplit = () => {
  if (resetType.value === 'grid') {
    const img = selectedImage.value
    if (img) {
      const newLinesX: number[] = []
      const newLinesY: number[] = []
      for (let i = 1; i < cols.value; i++) newLinesX.push((img.width! / cols.value) * i)
      for (let i = 1; i < rows.value; i++) newLinesY.push((img.height! / rows.value) * i)
      linesX.value = newLinesX
      linesY.value = newLinesY
      srMessage.value = t('tools.split.messages.resetToGrid')
      saveMeta()
    }
  } else {
    viewSettings.value = {
      lineWidth: 1.5,
      lineColor: 'white',
      lineOpacity: 0.95
    }
    srMessage.value = t('tools.split.messages.defaultRestored')
  }
  showResetConfirm.value = false
}

const colorButtonRefs = ref<HTMLElement[]>([])

const handleColorKeydown = (e: KeyboardEvent) => {
  const index = colorOptions.value.findIndex((c) => c.value === viewSettings.value.lineColor)
  let nextIndex = index

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    nextIndex = (index + 1) % colorOptions.value.length
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    nextIndex = (index - 1 + colorOptions.value.length) % colorOptions.value.length
  } else {
    return
  }

  e.preventDefault()
  viewSettings.value.lineColor = colorOptions.value[nextIndex]!.value
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
    const res = results.value.get(selectedImage.value.id)
    if (res) res.isDirty = true
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
    srMessage.value = t('tools.split.messages.lineDeletedKey', {
      index: index + 1,
      axis: axis === 'x' ? t('tools.split.verticalLine') : t('tools.split.horizontalLine')
    })
    selectedLine.value = null
    saveMeta()
    e.preventDefault()
    return
  }

  const step = e.shiftKey ? 10 : 1

  if (axis === 'x') {
    if (e.key === 'ArrowLeft')
      linesX.value[index] = clampDraggedLine('x', index, linesX.value[index]! - step)
    else if (e.key === 'ArrowRight')
      linesX.value[index] = clampDraggedLine('x', index, linesX.value[index]! + step)
    else return
  } else {
    if (e.key === 'ArrowUp')
      linesY.value[index] = clampDraggedLine('y', index, linesY.value[index]! - step)
    else if (e.key === 'ArrowDown')
      linesY.value[index] = clampDraggedLine('y', index, linesY.value[index]! + step)
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
    // Split 模式下，meta 最好存在组件状态里，或者从 results 里取
    // 这里暂时简化，因为 store 不再存 meta
    linesX.value = []
    linesY.value = []
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

// P1-3：把位置钳制在 [相邻线+1, 相邻线-1] ∩ [1, max-1]，保证每个切片至少 1px、线不重叠
const clampWithin = (pos: number, prev: number, next: number, max: number) => {
  const lo = Math.min(Math.max(prev + 1, 1), max - 1)
  const hi = Math.max(Math.min(next - 1, max - 1), lo)
  return Math.min(Math.max(pos, lo), hi)
}

// 拖拽中的线：以相邻线为界钳制
const clampDraggedLine = (axis: 'x' | 'y', index: number, pos: number) => {
  const img = selectedImage.value
  if (!img) return pos
  const max = axis === 'x' ? img.width! : img.height!
  const lines = axis === 'x' ? linesX.value : linesY.value
  const prev = index > 0 ? lines[index - 1]! : 0
  const next = index < lines.length - 1 ? lines[index + 1]! : max
  return clampWithin(pos, prev, next, max)
}

// 新添加的线：按插入位置（lines 保持有序）以相邻线为界钳制；
// 相邻线之间已无空隙（间隙 ≤1px）时返回 null，避免插入与既有线重合的重复线
const clampNewLine = (axis: 'x' | 'y', pos: number): number | null => {
  const img = selectedImage.value
  if (!img) return pos
  const max = axis === 'x' ? img.width! : img.height!
  const lines = axis === 'x' ? linesX.value : linesY.value
  let k = 0
  while (k < lines.length && lines[k]! <= pos) k++
  const prev = k > 0 ? lines[k - 1]! : 0
  const next = k < lines.length ? lines[k]! : max
  const clamped = clampWithin(pos, prev, next, max)
  if (clamped >= next || clamped <= prev) return null
  return clamped
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
      srMessage.value = t('tools.split.messages.switchedToFree')
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
      // P1-3：吸附后钳制到相邻线之间，避免零宽切片；吸附位置无空隙时退回原始位置
      let clampedX = clampNewLine('x', snappedX)
      if (clampedX === null) clampedX = clampNewLine('x', pos.x)
      if (clampedX === null) return
      linesX.value.push(clampedX)
      linesX.value.sort((a, b) => a - b)
      srMessage.value = t('tools.split.messages.lineAdded', {
        axis: t('tools.split.verticalLine'),
        pos: Math.round(clampedX)
      })
      // 自动选中新添加的线
      const newIndex = linesX.value.indexOf(clampedX)
      selectedLine.value = { axis: 'x', index: newIndex }
      if (snapped) triggerHaptic(8)
    } else {
      const { pos: snappedY, snapped } = snapLine(pos.y, 'y')
      // P1-3：吸附后钳制到相邻线之间，避免零宽切片；吸附位置无空隙时退回原始位置
      let clampedY = clampNewLine('y', snappedY)
      if (clampedY === null) clampedY = clampNewLine('y', pos.y)
      if (clampedY === null) return
      linesY.value.push(clampedY)
      linesY.value.sort((a, b) => a - b)
      srMessage.value = t('tools.split.messages.lineAdded', {
        axis: t('tools.split.horizontalLine'),
        pos: Math.round(clampedY)
      })
      // 自动选中新添加的线
      const newIndex = linesY.value.indexOf(clampedY)
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
    const { pos: snappedVal, snapped } = snapLine(axis === 'x' ? pos.x : pos.y, axis)
    // P1-3：吸附后钳制在 [相邻线+1, 相邻线-1] ∩ [1, max-1]，避免零宽切片与线重叠
    const newVal = clampDraggedLine(axis, index, snappedVal)

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
        srMessage.value = t('tools.split.messages.lineDeleted', {
          index: index + 1,
          axis: axis === 'x' ? t('tools.split.verticalLine') : t('tools.split.horizontalLine')
        })
      }
    }
    draggingLine.value = null
    saveMeta()
  }
}

const clearLines = () => {
  linesX.value = []
  linesY.value = []
  srMessage.value = t('tools.split.messages.cleared')
  saveMeta()
}

// P1-1：网格 ↔ 自由编辑切换时保持画布状态一致
// - grid → custom：把虚拟网格线物化为实体线，保证切换后画布不空
// - custom → grid：清空实体线，避免 custom→grid→custom 旧线复活
watch(editMode, (newMode, oldMode) => {
  const img = selectedImage.value
  if (newMode === 'grid') {
    linesX.value = []
    linesY.value = []
    selectedLine.value = null
    draggingLine.value = null
    hoveredLine.value = null
    return
  }
  if (oldMode === 'grid' && img) {
    const newLinesX: number[] = []
    const newLinesY: number[] = []
    for (let i = 1; i < cols.value; i++) newLinesX.push((img.width! / cols.value) * i)
    for (let i = 1; i < rows.value; i++) newLinesY.push((img.height! / rows.value) * i)
    linesX.value = newLinesX
    linesY.value = newLinesY
  }
})

watch(
  [rows, cols, editMode, centerMode, shave, outputFormat, outputQuality],
  () => {
    if (selectedImage.value) {
      const res = results.value.get(selectedImage.value.id)
      if (res) res.isDirty = true
    }
  },
  { deep: true }
)

// P1-2：视图层校验切分参数，阻止产生零宽/零高切片（配合引擎兜底 reject）
const validateSplit = (): string | null => {
  const img = selectedImage.value
  if (!img) return null
  const w = img.width!
  const h = img.height!

  let bX: number[]
  let bY: number[]
  if (editMode.value === 'custom') {
    bX = [0, ...[...linesX.value].sort((a, b) => a - b), w]
    bY = [0, ...[...linesY.value].sort((a, b) => a - b), h]
  } else {
    bX = Array.from({ length: cols.value + 1 }, (_, i) => (w / cols.value) * i)
    bY = Array.from({ length: rows.value + 1 }, (_, i) => (h / rows.value) * i)
  }

  for (let r = 0; r < bY.length - 1; r++) {
    for (let c = 0; c < bX.length - 1; c++) {
      const sw = bX[c + 1]! - bX[c]! - shave.value * 2
      const sh = bY[r + 1]! - bY[r]! - shave.value * 2
      if (sw <= 0 || sh <= 0) {
        return '切分参数导致切片尺寸为零，请减小裁剪边距或调整分割线位置'
      }
    }
  }
  return null
}

const handleApplyProcess = async () => {
  if (!selectedImage.value) return
  const id = selectedImage.value.id

  // P1-2：视图层阻止无效分割，避免静默产出空切片
  const invalid = validateSplit()
  if (invalid) {
    srMessage.value = invalid
    return
  }

  const res = await processSingle(id, {
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

  if (res) {
    const typedResult = res as ProcessResult
    const blobs = typedResult.blobs || (Array.isArray(res) ? res : [])
    results.value.set(id, {
      blobs,
      isDirty: false
    })
    return
  }

  // 处理失败（引擎错误/中止）：不写入结果 → 无结果则不进入 download CTA；播报可显示的引擎错误
  const img = store.images.find((i) => i.id === id)
  if (img && img.status === 'error' && img.error) {
    srMessage.value = img.error
  }
}

useResizeObserver(containerRef, resetView)

const ctaState = computed(() => {
  const img = selectedImage.value
  if (!img)
    return { text: t('tools.split.cta.select'), icon: Scissors, action: 'none', disabled: true }

  if (isAborting.value) {
    return { text: t('tools.split.cta.aborted'), icon: RotateCcw, action: 'none', disabled: true }
  }

  if (isProcessing.value) {
    const progressText =
      progress.value > 0
        ? t('tools.split.cta.rendering', { progress: Math.round(progress.value * 100) })
        : t('tools.split.cta.renderingNoProgress')
    return {
      text: `${progressText}`,
      icon: Trash2,
      action: 'abort',
      disabled: false
    }
  }

  const result = results.value.get(img.id)

  if (img.status === 'done' && result && !result.isDirty) {
    return {
      text: t('tools.split.cta.exportSlices'),
      icon: Download,
      action: 'download',
      disabled: false
    }
  }

  return {
    text: result?.isDirty ? t('tools.split.cta.updateSplit') : t('tools.split.cta.splitImage'),
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
    srMessage.value = t('tools.split.messages.abortedTask')
    setTimeout(() => {
      isAborting.value = false
    }, 800)
    return
  }

  if (state.action === 'download') {
    const result = results.value.get(selectedImage.value?.id || '')
    if (selectedImage.value && result) {
      downloadImage(result.blobs, selectedImage.value.file.name, 'split')
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
      ><ImageActionsToolbar
        view-id="split"
        :is-processing="isProcessing"
        :show-download-all="false"
        show-clear-all
        @reset-all="cleanupResults"
    /></template>

    <template #content>
      <!-- 无障碍实时播报 -->
      <div class="sr-only" aria-live="polite">{{ srMessage }}</div>
      <AppCanvasWorkspace
        ref="workspaceRef"
        :aria-label="t('tools.split.canvas.ariaLabel')"
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
            {{ t('tools.split.canvas.instructions') }}
          </div>
          <div class="relative">
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
                :aria-label="
                  t('tools.split.canvas.vLineAria', { index: i + 1, pos: Math.round(lx) })
                "
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
                :aria-label="
                  t('tools.split.canvas.hLineAria', { index: i + 1, pos: Math.round(ly) })
                "
              />
            </div>
          </div>
        </template>

        <!-- 【优化】：调整位置到底部中心，避开图片主体，并适配移动端托盘高度 -->
        <template #floating>
          <Transition name="fade-fast">
            <div
              v-if="editMode === 'custom' && !draggingLine"
              class="absolute left-1/2 -translate-x-1/2 bg-[var(--board)] px-4 py-2 rounded-2xl text-foreground text-[11px] font-medium border border-[var(--hairline)] pointer-events-none z-50 whitespace-nowrap flex items-center gap-2"
              :class="[isMobile ? 'bottom-[140px]' : 'bottom-24']"
            >
              <div
                class="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary"
              >
                <Scissors :size="12" />
              </div>
              <span
                >{{ t('tools.split.canvas.clickToAdd') }} <span class="mx-1 opacity-40">·</span>
                {{ t('tools.split.canvas.dragToMove') }}</span
              >
            </div>
          </Transition>
        </template>
      </AppCanvasWorkspace>
    </template>

    <template #sidebar>
      <section class="space-y-4">
        <AppSectionHeader :title="t('tools.split.gridSettings')" :icon="Grid3X3" />
        <div class="space-y-4 px-1">
          <AppSegmentedControl
            v-model="editMode"
            :options="[
              { label: t('tools.split.uniformGrid'), value: 'grid', icon: Grid3X3 },
              { label: t('tools.split.freeEdit'), value: 'custom', icon: Scissors }
            ]"
          />
          <div v-if="editMode === 'grid'" class="space-y-4">
            <div class="space-y-1">
              <AppSlider
                v-model="rows"
                :label="t('tools.split.verticalRows')"
                :icon="AlignCenter"
                :unit="t('tools.split.unitRow')"
                :min="1"
                :max="10"
                :step="1"
                :default-value="3"
              />
            </div>
            <div class="space-y-1">
              <AppSlider
                v-model="cols"
                :label="t('tools.split.horizontalCols')"
                :icon="Grid3X3"
                :unit="t('tools.split.unitCol')"
                :min="1"
                :max="10"
                :step="1"
                :default-value="3"
              />
            </div>
          </div>
          <div v-else class="flex flex-col gap-4 space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <AppButton
                @click="activeAxis = 'x'"
                fill
                :variant="activeAxis === 'x' ? 'primary' : 'secondary'"
                size="md"
                class="w-full rounded-xl h-11 border-2 text-xs"
                :class="{ 'border-primary shadow-md': activeAxis === 'x' }"
              >
                {{ t('tools.split.verticalLine') }}
              </AppButton>
              <AppButton
                @click="activeAxis = 'y'"
                fill
                :variant="activeAxis === 'y' ? 'primary' : 'secondary'"
                size="md"
                class="w-full rounded-xl h-11 border-2 text-xs"
                :class="{ 'border-primary shadow-md': activeAxis === 'y' }"
              >
                {{ t('tools.split.horizontalLine') }}
              </AppButton>
            </div>
            <div class="flex gap-2.5">
              <AppButton
                @click="handleResetToGrid"
                variant="secondary"
                size="sm"
                class="flex-1 rounded-[var(--radius-ctrl)] h-10 text-[12px] font-medium border-[var(--hairline)] bg-transparent"
                :icon="Grid3X3"
                :title="t('tools.split.syncGridTip')"
              >
                {{ t('tools.split.syncGrid') }}
              </AppButton>
              <AppButton
                @click="clearLines"
                variant="secondary"
                size="sm"
                class="flex-1 rounded-[var(--radius-ctrl)] h-10 text-[12px] font-medium border-[var(--hairline)] bg-transparent hover:text-[var(--danger)] hover:border-[var(--danger)]"
                :icon="Trash2"
              >
                {{ t('tools.split.clearAll') }}
              </AppButton>
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-4 pt-6 border-t border-[var(--hairline)]">
        <div class="flex items-center justify-between pr-1">
          <AppSectionHeader :title="t('tools.split.viewSettings')" :icon="Box" />
          <AppButton
            variant="ghost"
            size="sm"
            @click="resetViewSettings"
            class="w-8 h-8 p-0 rounded-lg text-muted-foreground/40 hover:text-primary"
            :title="t('tools.split.restoreDefaultView')"
            :aria-label="t('tools.split.restoreDefaultView')"
            :icon="RotateCcw"
          />
        </div>
        <div class="space-y-4 px-1">
          <div class="space-y-4">
            <div class="space-y-1">
              <AppSlider
                v-model="viewSettings.lineWidth"
                :label="t('tools.split.lineWidth')"
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
                class="text-[11px] font-medium text-muted-foreground block px-1"
                >{{ t('tools.split.lineColor') }}</span
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
                :label="t('tools.split.lineOpacity')"
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

      <section class="space-y-4 pt-6 border-t border-[var(--hairline)]">
        <AppSectionHeader :title="t('tools.split.enhanced')" :icon="Layers" />
        <div class="space-y-4 px-1">
          <div class="space-y-4">
            <div class="flex flex-col gap-1 px-1">
              <span class="text-[11px] font-medium text-muted-foreground">{{
                t('tools.split.alignMode')
              }}</span>
              <p class="text-[10px] text-muted-foreground/60 leading-relaxed">
                {{ t('tools.split.alignModeDesc') }}
              </p>
            </div>
            <AppSegmentedControl
              v-model="centerMode"
              :options="[
                { label: t('tools.split.standard'), value: 'none', icon: Grid3X3 },
                { label: t('tools.split.center'), value: 'center', icon: AlignCenter },
                { label: t('tools.split.square'), value: 'square', icon: Box }
              ]"
            />
          </div>

          <div class="space-y-4">
            <div class="space-y-1">
              <AppSlider
                v-model="shave"
                :label="t('tools.split.shave')"
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
        :title="t('tools.split.exportConfig')"
        class="pt-6 border-t border-[var(--hairline)] pb-4"
      />
    </template>

    <template #footer>
      <InspectorFooter>
        <AppButton
          size="lg"
          fill
          :variant="ctaState.action === 'download' ? 'success' : 'cta'"
          class="w-full rounded-xl transition-colors"
          :disabled="ctaState.disabled"
          :hint="ctaState.action === 'abort' ? t('tools.split.cta.clickToAbort') : undefined"
          @click="handleCtaClick"
        >
          <template #icon>
            <Loader2 v-if="isProcessing" :size="18" class="animate-spin mr-2" />
            <component :is="ctaState.icon" v-else :size="18" class="mr-2" />
          </template>
          <span class="font-medium text-sm" :class="{ 'tabular-nums': isProcessing }">
            {{ ctaState.text }}
          </span>
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
          <AppButton variant="danger" class="flex-1 rounded-xl h-11" @click="confirmResetSplit">
            {{ t('common.image.toolbar.confirm') }}
          </AppButton>
        </div>
      </div>
    </AppModal>
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
