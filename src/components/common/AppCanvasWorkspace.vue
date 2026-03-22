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
  isHandMode,
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
  isHandMode,
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
      class="flex-1 bg-muted/20 border border-border/60 rounded-3xl overflow-hidden relative w-full group select-none touch-none transition-all duration-300"
      :class="[
        isPanning ? 'cursor-grabbing' : isHandMode ? 'cursor-grab' : 'cursor-default',
        isHandMode ? 'ring-2 ring-primary/20 bg-primary/[0.02]' : ''
      ]"
      @wheel="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
    >
      <div class="absolute inset-0 transparency-grid opacity-20"></div>

      <!-- 核心修复：交互期间 (isPanning) 禁用 transition 以防止坐标计算滞后 -->
      <div
        class="absolute inset-0 flex items-center justify-center"
        :class="[isPanning ? 'transition-none' : transformDuration]"
        :style="{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }"
      >
        <div class="flex-shrink-0">
          <slot :scale="scale" :offset="offset" :is-panning="isPanning"></slot>
        </div>
      </div>

      <!-- 悬浮层 Slot -->
      <slot name="floating" :scale="scale" :offset="offset" :is-panning="isPanning"></slot>

      <!-- 智能引导提示 -->
      <div
        v-if="scale > 1.05"
        class="absolute top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-500"
        :class="isHandMode ? 'opacity-0 scale-95' : 'opacity-100 scale-100'"
      >
        <div
          class="px-3 py-1.5 bg-black/80 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-2 shadow-2xl"
        >
          <div
            class="px-1.5 py-0.5 bg-white/10 rounded border border-white/20 text-[9px] font-bold text-white/80 uppercase"
          >
            Space
          </div>
          <span class="text-[10px] text-white/60 font-medium tracking-wide"
            >按住空格可平移视图</span
          >
        </div>
      </div>

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
