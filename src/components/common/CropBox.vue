<script setup lang="ts">
import { ref, onUnmounted, onMounted, watch, computed, type CSSProperties } from 'vue'

interface Props {
  aspectRatio?: number
  imageUrl: string
  modelValue?: { x: number; y: number; w: number; h: number }
  gridMode?: 'none' | 'thirds' | 'golden' | 'cross'
  fillColor?: string
  scale?: number // 接收外部 scale，用于逆向缩放 UI 元素
}

const props = withDefaults(defineProps<Props>(), {
  gridMode: 'thirds',
  fillColor: 'transparent',
  aspectRatio: 0,
  scale: 1
})
const emit = defineEmits(['update:modelValue', 'change'])

const imgRef = ref<HTMLImageElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const imgRenderedRect = ref({ left: 0, top: 0, width: 0, height: 0 })

const internalCrop = ref({ x: 0, y: 0, w: 100, h: 100 })
const mouseRawPos = ref({ x: 0, y: 0 })
const isSnapping = ref(false)
const isDragging = ref(false)
const dragMode = ref<'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | null>(null)

// 逆向缩放样式，确保 UI 元素大小恒定
const reverseScaleStyle = computed(() => ({
  transform: `scale(${1 / props.scale})`,
  transformOrigin: 'center'
}))

const updateRenderedRect = () => {
  if (!imgRef.value) return
  const img = imgRef.value
  imgRenderedRect.value = {
    left: 0,
    top: 0,
    width: img.naturalWidth,
    height: img.naturalHeight
  }
}

watch(
  () => props.aspectRatio,
  (ar) => {
    if (!ar || ar <= 0 || !imgRef.value) return
    const n = { ...internalCrop.value }
    const imgRatio = imgRef.value.naturalWidth / imgRef.value.naturalHeight
    const targetPercentRatio = ar / imgRatio
    n.h = n.w / targetPercentRatio
    if (n.h > 100) {
      n.h = 100
      n.w = n.h * targetPercentRatio
    }
    if (n.w > 100) {
      n.w = 100
      n.h = n.w / targetPercentRatio
    }
    n.x = (100 - n.w) / 2
    n.y = (100 - n.h) / 2
    updateCrop(n)
  }
)

watch(
  () => props.modelValue,
  (v) => {
    if (v && JSON.stringify(v) !== JSON.stringify(internalCrop.value)) internalCrop.value = { ...v }
  },
  { deep: true, immediate: true }
)

const updateCrop = (n: typeof internalCrop.value) => {
  n.x = Number(n.x.toFixed(4))
  n.y = Number(n.y.toFixed(4))
  n.w = Number(n.w.toFixed(4))
  n.h = Number(n.h.toFixed(4))
  internalCrop.value = { ...n }
  emit('update:modelValue', { ...n })
  emit('change', {
    ...n,
    usePercentage: true,
    isDragging: isDragging.value,
    isSnapping: isSnapping.value
  })
}

const handleStart = (e: MouseEvent | TouchEvent, mode: typeof dragMode.value) => {
  if (e.cancelable) e.preventDefault()
  isDragging.value = true
  dragMode.value = mode
  const t = 'touches' in e ? e.touches[0] : e
  startX = t?.clientX ?? 0
  startY = t?.clientY ?? 0
  startCrop = { ...internalCrop.value }
  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', handleEnd)
  window.addEventListener('touchmove', handleMove, { passive: false })
  window.addEventListener('touchend', handleEnd)
}

let startX = 0,
  startY = 0,
  startCrop = { x: 0, y: 0, w: 0, h: 0 },
  rafId: number | null = null

const handleMove = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value || !imgRenderedRect.value.width) return
  if (e.cancelable) e.preventDefault()
  const t = 'touches' in e ? e.touches[0] : e,
    cx = t?.clientX ?? 0,
    cy = t?.clientY ?? 0
  const alt = 'altKey' in e ? (e as MouseEvent).altKey : false

  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    const rect = imgRef.value!.getBoundingClientRect()
    const dx = ((cx - startX) / rect.width) * 100
    const dy = ((cy - startY) / rect.height) * 100

    const snap = (val: number) => {
      if (alt) return { val, snapped: false }
      // 只有在靠近边缘时才吸附，但不强行限制在 0-100
      if (Math.abs(val - 0) < 2) return { val: 0, snapped: true }
      if (Math.abs(val - 100) < 2) return { val: 100, snapped: true }
      return { val, snapped: false }
    }

    const n = { ...startCrop }
    let snapActive = false

    if (dragMode.value === 'move') {
      n.x = startCrop.x + dx
      n.y = startCrop.y + dy
    } else {
      const mode = dragMode.value!
      if (mode.includes('n')) {
        const s = snap(startCrop.y + dy)
        n.y = s.val
        n.h = startCrop.h - (n.y - startCrop.y)
        if (s.snapped) snapActive = true
      }
      if (mode.includes('s')) {
        const s = snap(startCrop.y + startCrop.h + dy)
        n.h = s.val - n.y
        if (s.snapped) snapActive = true
      }
      if (mode.includes('w')) {
        const s = snap(startCrop.x + dx)
        n.x = s.val
        n.w = startCrop.w - (n.x - startCrop.x)
        if (s.snapped) snapActive = true
      }
      if (mode.includes('e')) {
        const s = snap(startCrop.x + startCrop.w + dx)
        n.w = s.val - n.x
        if (s.snapped) snapActive = true
      }

      if (props.aspectRatio) {
        const imgRatio = imgRef.value!.naturalWidth / imgRef.value!.naturalHeight
        const targetPercentRatio = props.aspectRatio / imgRatio
        if (mode === 'n' || mode === 's') n.w = n.h * targetPercentRatio
        else n.h = n.w / targetPercentRatio
      }
    }
    isSnapping.value = snapActive
    updateCrop(n)
  })
}

const handleEnd = () => {
  isDragging.value = false
  dragMode.value = null
  isSnapping.value = false
  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('mouseup', handleEnd)
  window.removeEventListener('touchmove', handleMove)
  window.removeEventListener('touchend', handleEnd)
  updateCrop(internalCrop.value)
}

onMounted(() => {
  if (imgRef.value?.complete) updateRenderedRect()
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative select-none touch-none flex items-center justify-center"
    :style="{ width: imgRenderedRect.width + 'px', height: imgRenderedRect.height + 'px' }"
  >
    <img
      ref="imgRef"
      :src="imageUrl"
      class="block w-full h-full shadow-sm pointer-events-none"
      @load="updateRenderedRect"
    />

    <!-- 裁剪交互层 -->
    <div class="absolute inset-0 z-20 pointer-events-none">
      <div
        class="absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] cursor-move pointer-events-auto transition-shadow overflow-hidden"
        :style="{
          left: internalCrop.x + '%',
          top: internalCrop.y + '%',
          width: internalCrop.w + '%',
          height: internalCrop.h + '%'
        }"
        @mousedown="handleStart($event, 'move')"
      >
        <!-- 内部透明棋盘格 (仅在填充色为透明时显示) -->
        <div
          v-if="props.fillColor === 'transparent'"
          class="absolute inset-0 transparency-grid pointer-events-none opacity-40"
          :style="{ backgroundSize: `${20 / props.scale}px ${20 / props.scale}px` }"
        ></div>

        <!-- 网格线 -->
        <div
          v-if="gridMode === 'thirds'"
          class="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40"
        >
          <div v-for="i in 9" :key="i" class="border-[0.5px] border-white/50"></div>
        </div>

        <!-- 角点手柄 (逆向缩放以保持尺寸) -->
        <div
          v-for="pos in ['nw', 'ne', 'sw', 'se']"
          :key="pos"
          class="absolute w-10 h-10 flex z-30 group/handle"
          :style="{
            transform: `translate(-50%, -50%) scale(${1 / props.scale})`,
            left: pos.includes('e') ? '100%' : '0',
            top: pos.includes('s') ? '100%' : '0',
            cursor: `${pos}-resize`
          }"
          @mousedown.stop="handleStart($event, pos as any)"
        >
          <div
            class="m-auto w-3 h-3 bg-white border-2 border-primary rounded-sm shadow-xl transition-all group-hover/handle:scale-125"
          ></div>
        </div>

        <!-- 边中点手柄 -->
        <div
          v-for="pos in ['n', 's', 'w', 'e']"
          :key="pos"
          class="absolute flex z-20 group/handle"
          :style="{
            top: pos === 'n' ? '0' : pos === 's' ? '100%' : '50%',
            left: pos === 'w' ? '0' : pos === 'e' ? '100%' : '50%',
            width: '40px',
            height: '40px',
            transform: `translate(-50%, -50%) scale(${1 / props.scale})`,
            cursor: `${pos}-resize`
          }"
          @mousedown.stop="handleStart($event, pos as any)"
        >
          <div
            :class="['n', 's'].includes(pos) ? 'w-5 h-1.5' : 'w-1.5 h-5'"
            class="m-auto bg-white border border-primary/50 rounded-full shadow-md group-hover/handle:bg-primary"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>
