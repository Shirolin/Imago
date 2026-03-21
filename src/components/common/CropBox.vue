<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'

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

const internalCropPx = ref({ x: 0, y: 0, w: 0, h: 0 })
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

// 转换工具：百分比 -> 像素
const toPx = (p: { x: number; y: number; w: number; h: number }) => {
  if (!imgRef.value) return { x: 0, y: 0, w: 0, h: 0 }
  const { naturalWidth: nw, naturalHeight: nh } = imgRef.value
  return {
    x: (p.x / 100) * nw,
    y: (p.y / 100) * nh,
    w: (p.w / 100) * nw,
    h: (p.h / 100) * nh
  }
}

// 转换工具：像素 -> 百分比
const toPercent = (px: { x: number; y: number; w: number; h: number }) => {
  if (!imgRef.value) return { x: 0, y: 0, w: 100, h: 100 }
  const { naturalWidth: nw, naturalHeight: nh } = imgRef.value
  return {
    x: (px.x / nw) * 100,
    y: (px.y / nh) * 100,
    w: (px.w / nw) * 100,
    h: (px.h / nh) * 100
  }
}

// 监听外部 modelValue 变化 (优化：字段显式比对，避免频繁序列化)
watch(
  () => props.modelValue,
  (v) => {
    if (v && imgRef.value) {
      const targetPx = toPx(v)
      const current = internalCropPx.value
      // 显式比对核心字段
      const isChanged =
        Math.abs(targetPx.x - current.x) > 0.0001 ||
        Math.abs(targetPx.y - current.y) > 0.0001 ||
        Math.abs(targetPx.w - current.w) > 0.0001 ||
        Math.abs(targetPx.h - current.h) > 0.0001

      if (isChanged) {
        internalCropPx.value = targetPx
      }
    }
  },
  { deep: true, immediate: true }
)

const updateCrop = (newPx: typeof internalCropPx.value) => {
  if (!imgRef.value) return
  const { naturalWidth: nw, naturalHeight: nh } = imgRef.value

  // 严格边界约束
  newPx.w = Math.max(10, Math.min(newPx.w, nw))
  newPx.h = Math.max(10, Math.min(newPx.h, nh))
  newPx.x = Math.max(0, Math.min(newPx.x, nw - newPx.w))
  newPx.y = Math.max(0, Math.min(newPx.y, nh - newPx.h))

  internalCropPx.value = { ...newPx }
  const percent = toPercent(newPx)
  emit('update:modelValue', percent)
  emit('change', {
    ...percent,
    usePercentage: true,
    isDragging: isDragging.value,
    isSnapping: isSnapping.value
  })
}

const handleReset = () => {
  if (!imgRef.value) return
  updateCrop({
    x: 0,
    y: 0,
    w: imgRef.value.naturalWidth,
    h: imgRef.value.naturalHeight
  })
}

// 处理比例锁定
watch(
  () => props.aspectRatio,
  (ar) => {
    if (!ar || ar <= 0 || !imgRef.value) return
    const { naturalWidth: nw, naturalHeight: nh } = imgRef.value
    const n = { ...internalCropPx.value }

    if (nw / nh > ar) {
      n.h = nh
      n.w = nh * ar
    } else {
      n.w = nw
      n.h = nw / ar
    }
    n.x = (nw - n.w) / 2
    n.y = (nh - n.h) / 2
    updateCrop(n)
  }
)

const handleStart = (e: MouseEvent | TouchEvent, mode: typeof dragMode.value) => {
  if (e.cancelable) e.preventDefault()
  isDragging.value = true
  dragMode.value = mode
  const t = 'touches' in e ? e.touches[0] : e
  startX = t?.clientX ?? 0
  startY = t?.clientY ?? 0
  startCropPx = { ...internalCropPx.value }
  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', handleEnd)
  window.addEventListener('touchmove', handleMove, { passive: false })
  window.addEventListener('touchend', handleEnd)
}

let startX = 0,
  startY = 0,
  startCropPx = { x: 0, y: 0, w: 0, h: 0 },
  rafId: number | null = null

const handleMove = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value || !imgRef.value) return
  if (e.cancelable) e.preventDefault()
  const t = 'touches' in e ? e.touches[0] : e,
    cx = t?.clientX ?? 0,
    cy = t?.clientY ?? 0
  const alt = 'altKey' in e ? (e as MouseEvent).altKey : false

  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    const rect = imgRef.value!.getBoundingClientRect()
    const zoom = rect.width / imgRef.value!.naturalWidth
    const dx = (cx - startX) / zoom
    const dy = (cy - startY) / zoom

    const { naturalWidth: nw, naturalHeight: nh } = imgRef.value!
    const snap = (val: number, limit: number) => {
      if (alt) return { val, snapped: false }
      if (Math.abs(val - 0) < 10 / zoom) return { val: 0, snapped: true }
      if (Math.abs(val - limit) < 10 / zoom) return { val: limit, snapped: true }
      return { val, snapped: false }
    }

    const n = { ...startCropPx }
    let snapActive = false

    if (dragMode.value === 'move') {
      n.x = startCropPx.x + dx
      n.y = startCropPx.y + dy
    } else {
      const mode = dragMode.value!
      if (mode.includes('n')) {
        const s = snap(startCropPx.y + dy, nh)
        n.y = s.val
        n.h = startCropPx.h - (n.y - startCropPx.y)
        if (s.snapped) snapActive = true
      }
      if (mode.includes('s')) {
        const s = snap(startCropPx.y + startCropPx.h + dy, nh)
        n.h = s.val - n.y
        if (s.snapped) snapActive = true
      }
      if (mode.includes('w')) {
        const s = snap(startCropPx.x + dx, nw)
        n.x = s.val
        n.w = startCropPx.w - (n.x - startCropPx.x)
        if (s.snapped) snapActive = true
      }
      if (mode.includes('e')) {
        const s = snap(startCropPx.x + startCropPx.w + dx, nw)
        n.w = s.val - n.x
        if (s.snapped) snapActive = true
      }

      // 处理比例锁定
      if (props.aspectRatio) {
        if (mode === 'n' || mode === 's') n.w = n.h * props.aspectRatio
        else n.h = n.w / props.aspectRatio
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
  updateCrop(internalCropPx.value)
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
        class="absolute border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] cursor-move pointer-events-auto transition-all overflow-hidden"
        :class="[
          isDragging ? 'border-primary scale-[1.002]' : 'border-primary/80',
          isSnapping ? 'ring-2 ring-primary ring-offset-0 animate-pulse-subtle' : ''
        ]"
        :style="{
          left: (internalCropPx.x / (imgRef?.naturalWidth || 1)) * 100 + '%',
          top: (internalCropPx.y / (imgRef?.naturalHeight || 1)) * 100 + '%',
          width: (internalCropPx.w / (imgRef?.naturalWidth || 1)) * 100 + '%',
          height: (internalCropPx.h / (imgRef?.naturalHeight || 1)) * 100 + '%'
        }"
        @mousedown="handleStart($event, 'move')"
        @dblclick="handleReset"
      >
        <!-- 动态跟随 HUD (仅拖拽显示) -->
        <div
          v-if="isDragging"
          class="absolute top-2 right-2 z-40 px-2 py-1 bg-primary text-white text-[10px] font-black rounded-md shadow-2xl flex items-center gap-1.5 animate-in fade-in zoom-in duration-200"
          :style="reverseScaleStyle"
        >
          <span class="tabular-nums">{{ Math.round(internalCropPx.w) }}</span>
          <span class="opacity-40">×</span>
          <span class="tabular-nums">{{ Math.round(internalCropPx.h) }}</span>
        </div>

        <!-- 内部透明棋盘格 (仅在填充色为透明时显示) -->
        <div
          v-if="props.fillColor === 'transparent'"
          class="absolute inset-0 transparency-grid pointer-events-none opacity-20"
          :style="{ backgroundSize: `${20 / props.scale}px ${20 / props.scale}px` }"
        ></div>

        <!-- 动态强化网格线 -->
        <div
          v-if="gridMode === 'thirds'"
          class="absolute inset-0 grid grid-cols-3 grid-rows-3 transition-opacity duration-300"
          :class="isDragging ? 'opacity-80' : 'opacity-30'"
        >
          <div
            v-for="i in 9"
            :key="i"
            class="border-[0.5px] border-white/40 mix-blend-difference"
          ></div>
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
