<script setup lang="ts">
import { ref } from 'vue'
import AppCanvasControls from './AppCanvasControls.vue'
import { useCanvasView } from '../../composables/useCanvasView'

interface Props {
  transformDuration?: string
  showControls?: boolean
  hideDefaultHint?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'wheel', evt: WheelEvent): void
  (e: 'pointerdown', evt: PointerEvent): void
  (e: 'pointermove', evt: PointerEvent): void
  (e: 'pointerup', evt: PointerEvent): void
  (e: 'reset'): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)

const isHovered = ref(false)

const {
  scale,
  offset,
  isPanning,
  fitScale,
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

const triggerAutoFit = (contentW: number, contentH: number, padding = 80, useAnimation = true) => {
  const newScale = getAutoFitScale(contentW, contentH, padding)

  // 核心修复：如果是超大图切换，瞬间归零 offset 且可以禁用动画防止偏移
  if (!useAnimation) {
    // 这里通过某种方式临时禁用 transition，虽然 Vue class 绑定也可以，但直接操作 ref 更快
    scale.value = newScale
    offset.value = { x: 0, y: 0 }
  } else {
    scale.value = newScale
    offset.value = { x: 0, y: 0 }
  }
}

defineExpose({
  scale,
  offset,
  isPanning,
  fitScale,
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
      role="application"
      :aria-label="($attrs['aria-label'] as string) || '图像工作区'"
      :aria-describedby="$attrs['aria-describedby'] as string"
      :class="[
        isPanning ? 'cursor-grabbing-forced' : isHandMode ? 'cursor-grab-forced' : 'cursor-default',
        isHandMode ? 'ring-2 ring-primary/20 bg-primary/[0.02]' : ''
      ]"
      @wheel="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerenter="isHovered = true"
      @pointerleave="isHovered = false"
    >
      <div class="absolute inset-0 transparency-grid opacity-20"></div>

      <!-- 核心修复：重构坐标系 -->
      <!-- 使用 top-1/2 left-1/2 锚点配合 translate(-50%, -50%) -->
      <!-- 这样无论子元素 (Canvas) 原始尺寸多大，其中点始终对齐工作区中心 -->
      <div
        class="absolute top-1/2 left-1/2 will-change-transform isolate"
        :class="[isPanning ? 'transition-none' : transformDuration]"
        :style="{
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`
        }"
      >
        <div class="flex-shrink-0 backface-hidden">
          <slot :scale="scale" :offset="offset" :is-panning="isPanning"></slot>
        </div>
      </div>

      <!-- 悬浮层 Slot -->
      <slot name="floating" :scale="scale" :offset="offset" :is-panning="isPanning"></slot>

      <!-- 智能引导提示 (强化版) -->
      <div
        v-if="!hideDefaultHint && (isHovered || scale > fitScale * 1.05)"
        class="absolute top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-500"
        :class="isHandMode ? 'opacity-0 scale-95' : 'opacity-100 scale-100'"
      >
        <div
          class="px-4 py-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-3 shadow-2xl ring-1 ring-white/5"
        >
          <!-- 仅在非触摸设备显示空格提示 -->
          <div class="hidden sm:flex items-center gap-1.5">
            <div
              class="px-1.5 py-0.5 bg-white/10 rounded border border-white/20 text-[9px] font-bold text-white/80 uppercase"
            >
              Space
            </div>
            <span class="text-white/40 text-[10px]">+</span>
            <div class="p-1 bg-white/10 rounded-md border border-white/20">
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                stroke="currentColor"
                stroke-width="2.5"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-white/80"
              >
                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5" />
                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v10" />
                <path d="M10 10.5V3a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v9" />
                <path
                  d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"
                />
              </svg>
            </div>
            <div class="w-px h-3 bg-white/10 mx-1"></div>
          </div>
          <span class="text-[10px] text-white/70 font-bold tracking-wide">
            {{ scale > fitScale * 1.05 ? '按住空格拖拽平移' : '完整视图预览' }}
          </span>
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

<style scoped>
/* 强制光标覆盖：确保在抓手模式下，子元素的光标（如裁剪框的移动光标）不会遮盖抓手手型 */
.cursor-grab-forced,
.cursor-grab-forced * {
  cursor: grab !important;
}
.cursor-grabbing-forced,
.cursor-grabbing-forced * {
  cursor: grabbing !important;
}
</style>
