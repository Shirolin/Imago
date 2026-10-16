import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { gridLines } from '../lib/splitLines'
import type { ImageItem } from '../stores/imageStore'
import type { ViewSettings } from '../lib/engines/types'

/** 线的交互态引用：hover / 拖拽 / 键盘选中 */
export type SplitLineKind = { axis: 'x' | 'y'; index: number } | null

/**
 * 分割线画布 —— 把 SplitView 里混在编辑状态机中的渲染职责收进一个模块。
 *
 * 输入都是视图已有的响应式状态（编辑态归视图，绘制归这里），
 * 输出只有 requestDraw 与 primaryColor。内部封装：
 * - 预览解码进离屏画布，按图片 id 失效（loadId 竞态守卫防旧图覆盖新图）
 * - 主题 --primary 观察器：被动 MutationObserver，变化即触发重绘，
 *   避免在渲染循环里轮询 getComputedStyle
 * - 描线规则：黑底高对比衬线（浅背景可见）+ 核心线（primary 白黑蓝红映射）
 *   + 激活态外发光，全部按 workspace scale 归一，缩放时视觉粗细恒定
 * - rAF 合并重绘；backing store 仅在图片尺寸变化时重置（反复赋值会
 *   逐帧清空并重新分配内存）
 * - 卸载时断开观察器并显式清零离屏画布释放显存
 *
 * 性能契约：watch 细化到原子属性；视图不必也无法触发未合并的同步绘制。
 */
export interface UseSplitCanvasOptions {
  canvasRef: Ref<HTMLCanvasElement | null>
  /** AppCanvasWorkspace 实例；绘制读取其 scale */
  workspaceRef: Ref<{ scale?: number } | null>
  image: ComputedRef<ImageItem | null>
  editMode: Ref<'grid' | 'custom'>
  rows: Ref<number>
  cols: Ref<number>
  linesX: Ref<number[]>
  linesY: Ref<number[]>
  hoveredLine: Ref<SplitLineKind>
  draggingLine: Ref<SplitLineKind>
  selectedLine: Ref<SplitLineKind>
  viewSettings: Ref<ViewSettings>
  /** 新图解码完成后回调（视图在此触发 autofit 等一次性动作） */
  onImageReady?: () => void
}

export function useSplitCanvas(options: UseSplitCanvasOptions) {
  const {
    canvasRef,
    workspaceRef,
    image,
    editMode,
    rows,
    cols,
    linesX,
    linesY,
    hoveredLine,
    draggingLine,
    selectedLine,
    viewSettings,
    onImageReady
  } = options

  /** 主题主色（默认值与 SplitView 历史行为一致）；颜色选择器的 primary 滑块也读它 */
  const primaryColor = ref('hsl(215, 100%, 50%)')

  let offscreenCanvas: HTMLCanvasElement | null = null
  let isDrawingRaf = false
  let themeObserver: MutationObserver | null = null
  let lastLoadId = 0

  const requestDraw = () => {
    if (!isDrawingRaf) {
      isDrawingRaf = true
      requestAnimationFrame(() => {
        draw()
        isDrawingRaf = false
      })
    }
  }

  const updateThemeColor = () => {
    const root = document.documentElement
    const colorPrimary = getComputedStyle(root).getPropertyValue('--primary').trim()
    if (!colorPrimary) return
    const next = colorPrimary.includes('hsl') ? colorPrimary : `hsl(${colorPrimary})`
    if (next !== primaryColor.value) {
      primaryColor.value = next
      requestDraw()
    }
  }

  const updateCachedImage = () => {
    const imgData = image.value
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
      if (onImageReady) nextTick(onImageReady)
    }
  }

  const draw = () => {
    const canvas = canvasRef.value
    const ctx = canvas?.getContext('2d')
    const img = image.value
    const scale = workspaceRef.value?.scale || 1
    if (!canvas || !ctx || !offscreenCanvas || !img) return

    // 仅在图片尺寸变化时重置 backing store；相同尺寸重复赋值会逐帧清空并重新分配内存。
    if (canvas.width !== img.width!) canvas.width = img.width!
    if (canvas.height !== img.height!) canvas.height = img.height!
    ctx.clearRect(0, 0, img.width!, img.height!)
    ctx.drawImage(offscreenCanvas, 0, 0)

    const activeColor = primaryColor.value
    const { lineWidth, lineColor, lineOpacity } = viewSettings.value

    const drawStylizedLine = (
      pos: number,
      isVertical: boolean,
      isHovered: boolean,
      isDragging: boolean,
      isSelected: boolean
    ) => {
      ctx.save()
      const isActive = isHovered || isDragging || isSelected

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

    const isHot = (kind: SplitLineKind, axis: 'x' | 'y', i: number) =>
      !!kind && kind.axis === axis && kind.index === i

    // 绘制网格线 (均分模式)：与悬停命中 / 校验共用 gridLines 定义
    if (editMode.value === 'grid') {
      gridLines(cols.value, img.width!).forEach((v) =>
        drawStylizedLine(v, true, false, false, false)
      )
      gridLines(rows.value, img.height!).forEach((v) =>
        drawStylizedLine(v, false, false, false, false)
      )
    } else {
      // 绘制自定义线 (自由模式)
      linesX.value.forEach((lx, i) =>
        drawStylizedLine(
          lx,
          true,
          isHot(hoveredLine.value, 'x', i),
          isHot(draggingLine.value, 'x', i),
          isHot(selectedLine.value, 'x', i)
        )
      )
      linesY.value.forEach((ly, i) =>
        drawStylizedLine(
          ly,
          false,
          isHot(hoveredLine.value, 'y', i),
          isHot(draggingLine.value, 'y', i),
          isHot(selectedLine.value, 'y', i)
        )
      )
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

  // 主题色变化 → 重绘（新图解码路径的 updateThemeColor 已自带重绘）
  watch(primaryColor, requestDraw)

  watch(() => image.value?.id, updateCachedImage, { immediate: true })

  onMounted(() => {
    updateThemeColor()

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

  return { primaryColor }
}
