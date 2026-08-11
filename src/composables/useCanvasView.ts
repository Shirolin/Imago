import { ref, type Ref, onMounted, onUnmounted } from 'vue'
import { useElementBounding } from '@vueuse/core'

export function useCanvasView(containerRef: Ref<HTMLElement | null>) {
  const scale = ref(1)
  const offset = ref({ x: 0, y: 0 })
  const isPanning = ref(false)
  const isSpacePressed = ref(false)
  const startPanPos = ref({ x: 0, y: 0 })

  const { width: cw, height: ch, left: cl, top: ct } = useElementBounding(containerRef)

  // 核心：输入检测，防止在输入框中按空格触发平移
  const isInputFocused = () => {
    const el = document.activeElement
    return (
      el?.tagName === 'INPUT' ||
      el?.tagName === 'TEXTAREA' ||
      (el as HTMLElement)?.isContentEditable
    )
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !isInputFocused()) {
      e.preventDefault()
      isSpacePressed.value = true
    }
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      isSpacePressed.value = false
    }
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
    // 触发条件：空格已按下 OR 鼠标中键 OR Alt 键
    if (isSpacePressed.value || e.button === 1 || e.altKey) {
      isPanning.value = true
      startPanPos.value = { x: e.clientX - offset.value.x, y: e.clientY - offset.value.y }
      containerRef.value?.setPointerCapture(e.pointerId)
      if (e.button === 1) e.preventDefault() // 防止中键触发自动滚动
    }
  }

  const handlePointerMove = (e: PointerEvent) => {
    if (isPanning.value) {
      offset.value = { x: e.clientX - startPanPos.value.x, y: e.clientY - startPanPos.value.y }
    }
  }

  const handlePointerUp = () => {
    isPanning.value = false
  }

  // P2-3: 窗口失焦（如切换标签页/点击地址栏）时 Space 键状态会残留，
  // 导致回到页面后画布一直被当作抓手模式。blur 时统一复位。
  const handleBlur = () => {
    isSpacePressed.value = false
    isPanning.value = false
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('blur', handleBlur)
  })

  // P2-2: 与 handleWheel 一致的 [0.01, 20] 钳制 + 中心缩放。
  // 缩放围绕画布中心进行：offset 按 newScale/scale 等比补偿，中心锚点不动。
  const zoomIn = () => {
    const newScale = Math.min(scale.value * 1.2, 20)
    if (newScale === scale.value) return
    const ratio = newScale / scale.value
    offset.value = { x: offset.value.x * ratio, y: offset.value.y * ratio }
    scale.value = newScale
  }

  const zoomOut = () => {
    const newScale = Math.max(scale.value * 0.8, 0.01)
    if (newScale === scale.value) return
    const ratio = newScale / scale.value
    offset.value = { x: offset.value.x * ratio, y: offset.value.y * ratio }
    scale.value = newScale
  }
  const zoom100 = () => {
    scale.value = 1
    offset.value = { x: 0, y: 0 }
  }

  const fitScale = ref(1)

  const getAutoFitScale = (imgW: number, imgH: number, padding = 80) => {
    if (!containerRef.value) return 1
    const availableW = containerRef.value.clientWidth - padding
    const availableH = containerRef.value.clientHeight - padding
    const s = Math.min(availableW / imgW, availableH / imgH, 1)
    fitScale.value = s
    return s
  }

  return {
    scale,
    offset,
    isPanning,
    fitScale,
    isHandMode: isSpacePressed, // 提供给 UI 的抓手模式状态
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    zoomIn,
    zoomOut,
    zoom100,
    getAutoFitScale
  }
}
