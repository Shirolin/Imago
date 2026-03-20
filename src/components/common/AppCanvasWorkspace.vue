<script setup lang="ts">
import { ref } from 'vue'
import AppCanvasControls from './AppCanvasControls.vue'
import { useCanvasView } from '../../composables/useCanvasView'

interface Props {
  transformDuration?: string
  showControls?: boolean
}

withDefaults(defineProps<Props>(), {
  transformDuration: 'duration-75',
  showControls: true
})

const emit = defineEmits<{
  (e: 'wheel', evt: WheelEvent): void
  (e: 'pointerdown', evt: PointerEvent): void
  (e: 'pointermove', evt: PointerEvent): void
  (e: 'pointerup', evt: PointerEvent): void
  (e: 'reset'): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)

const {
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
} = useCanvasView(containerRef)

const onWheel = (e: WheelEvent) => {
  handleWheel(e)
  emit('wheel', e)
}
const onPointerDown = (e: PointerEvent) => {
  handlePointerDown(e)
  emit('pointerdown', e)
}
const onPointerMove = (e: PointerEvent) => {
  handlePointerMove(e)
  emit('pointermove', e)
}
const onPointerUp = (e: PointerEvent) => {
  handlePointerUp()
  emit('pointerup', e)
}

const triggerAutoFit = (contentW: number, contentH: number, padding = 80) => {
  scale.value = getAutoFitScale(contentW, contentH, padding)
  offset.value = { x: 0, y: 0 }
}

defineExpose({
  scale,
  offset,
  isPanning,
  zoomIn,
  zoomOut,
  zoom100,
  triggerAutoFit,
  containerRef
})
</script>

<template>
  <div class="h-full flex flex-col p-4 md:p-6 overflow-hidden w-full relative bg-muted/10">
    <div
      ref="containerRef"
      class="flex-1 bg-muted/20 border border-border/60 rounded-3xl overflow-hidden relative w-full group select-none touch-none"
      :class="{ 'cursor-grabbing': isPanning }"
      @wheel="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
    >
      <div class="absolute inset-0 transparency-grid opacity-20"></div>

      <div
        class="absolute inset-0 flex items-center justify-center transition-transform"
        :class="transformDuration"
        :style="{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }"
      >
        <slot :scale="scale" :offset="offset" :is-panning="isPanning"></slot>
      </div>

      <!-- 悬浮层 Slot -->
      <slot name="floating" :scale="scale" :offset="offset" :is-panning="isPanning"></slot>

      <!-- 缩放控制栏 -->
      <div v-if="showControls" class="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
        <AppCanvasControls
          :scale="scale"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          @zoom100="zoom100"
          @reset="emit('reset')"
        />
      </div>
    </div>
  </div>
</template>
