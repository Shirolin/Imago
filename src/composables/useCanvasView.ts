import { ref, type Ref } from 'vue'
import { useElementBounding } from '@vueuse/core'

export function useCanvasView(containerRef: Ref<HTMLElement | null>) {
  const scale = ref(1)
  const offset = ref({ x: 0, y: 0 })
  const isPanning = ref(false)
  const startPanPos = ref({ x: 0, y: 0 })

  const { width: cw, height: ch, left: cl, top: ct } = useElementBounding(containerRef)

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
    if (e.button === 1 || e.altKey || (e.pointerType === 'touch' && e.shiftKey)) {
      isPanning.value = true
      startPanPos.value = { x: e.clientX - offset.value.x, y: e.clientY - offset.value.y }
      containerRef.value?.setPointerCapture(e.pointerId)
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

  const zoomIn = () => (scale.value *= 1.2)
  const zoomOut = () => (scale.value *= 0.8)
  const zoom100 = () => {
    scale.value = 1
    offset.value = { x: 0, y: 0 }
  }

  const getAutoFitScale = (imgW: number, imgH: number, padding = 80) => {
    if (!containerRef.value) return 1
    const availableW = containerRef.value.clientWidth - padding
    const availableH = containerRef.value.clientHeight - padding
    return Math.min(availableW / imgW, availableH / imgH, 1)
  }

  return {
    scale,
    offset,
    isPanning,
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
