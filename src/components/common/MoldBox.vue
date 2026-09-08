<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  containMold,
  isOutOfBounds,
  resizeMold,
  type MoldHandle,
  type MoldRect
} from '../../lib/moldCut'

interface Props {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  modelValue: MoldRect
  /** 工作台缩放，用于把屏幕位移换算回原图像素 */
  scale?: number
  /** 角手柄缩放时保持宽高比（跟随侧栏锁比开关） */
  preserveRatio?: boolean
}

const props = withDefaults(defineProps<Props>(), { scale: 1, preserveRatio: false })
const emit = defineEmits<{
  (e: 'update:modelValue', value: MoldRect): void
  (e: 'change', value: MoldRect): void
}>()

const { t } = useI18n()

/** 反缩放：徽标与手柄保持恒定屏幕尺寸，不随画布缩放忽大忽小 */
const invScale = computed(() => 1 / (props.scale || 1))

const out = computed(() => isOutOfBounds(props.modelValue, props.imageWidth, props.imageHeight))

// --- 移动 ---
const moving = ref(false)
let moveClient = { x: 0, y: 0 }
let moveStart = { x: 0, y: 0 }

const onMoveDown = (e: PointerEvent) => {
  if (e.button !== 0 || e.altKey) return
  e.stopPropagation()
  e.preventDefault()
  moving.value = true
  moveClient = { x: e.clientX, y: e.clientY }
  moveStart = { x: props.modelValue.x, y: props.modelValue.y }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

const onMoveMove = (e: PointerEvent) => {
  if (!moving.value) return
  const next = containMold(
    {
      ...props.modelValue,
      x: Math.round(moveStart.x + (e.clientX - moveClient.x) / props.scale),
      y: Math.round(moveStart.y + (e.clientY - moveClient.y) / props.scale)
    },
    props.imageWidth,
    props.imageHeight
  )
  emit('update:modelValue', next)
}

const onMoveUp = (e: PointerEvent) => {
  if (!moving.value) return
  moving.value = false
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    /* 忽略重复释放 */
  }
  emit('change', props.modelValue)
}

// --- 缩放手柄 ---
const resizing = ref<MoldHandle | null>(null)
let resizeClient = { x: 0, y: 0 }
let resizeStart: MoldRect = { x: 0, y: 0, w: 1, h: 1 }

const HANDLES: { id: MoldHandle; x: string; y: string; cursor: string }[] = [
  { id: 'nw', x: '0%', y: '0%', cursor: 'nwse-resize' },
  { id: 'n', x: '50%', y: '0%', cursor: 'ns-resize' },
  { id: 'ne', x: '100%', y: '0%', cursor: 'nesw-resize' },
  { id: 'e', x: '100%', y: '50%', cursor: 'ew-resize' },
  { id: 'se', x: '100%', y: '100%', cursor: 'nwse-resize' },
  { id: 's', x: '50%', y: '100%', cursor: 'ns-resize' },
  { id: 'sw', x: '0%', y: '100%', cursor: 'nesw-resize' },
  { id: 'w', x: '0%', y: '50%', cursor: 'ew-resize' }
]

const onHandleDown = (e: PointerEvent, handle: MoldHandle) => {
  if (e.button !== 0 || e.altKey) return
  e.stopPropagation()
  e.preventDefault()
  resizing.value = handle
  resizeClient = { x: e.clientX, y: e.clientY }
  resizeStart = { ...props.modelValue }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

const onHandleMove = (e: PointerEvent) => {
  if (!resizing.value) return
  emit(
    'update:modelValue',
    resizeMold(
      resizeStart,
      resizing.value,
      (e.clientX - resizeClient.x) / props.scale,
      (e.clientY - resizeClient.y) / props.scale,
      props.preserveRatio
    )
  )
}

const onHandleUp = (e: PointerEvent) => {
  if (!resizing.value) return
  resizing.value = null
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    /* 忽略重复释放 */
  }
  emit('change', props.modelValue)
}

const activeCursor = computed(() => (moving.value ? 'grabbing' : 'move'))
</script>

<template>
  <div
    class="relative overflow-hidden rounded-[4px]"
    :style="{ width: imageWidth + 'px', height: imageHeight + 'px' }"
  >
    <img
      :src="imageUrl"
      alt=""
      draggable="false"
      class="absolute inset-0 h-full w-full select-none"
      :width="imageWidth"
      :height="imageHeight"
    />
    <div
      class="absolute z-10 touch-none select-none"
      :style="{
        left: modelValue.x + 'px',
        top: modelValue.y + 'px',
        width: modelValue.w + 'px',
        height: modelValue.h + 'px',
        boxShadow: '0 0 0 9999px rgba(20, 20, 19, 0.45)',
        cursor: activeCursor
      }"
      @pointerdown="onMoveDown"
      @pointermove="onMoveMove"
      @pointerup="onMoveUp"
      @pointercancel="onMoveUp"
      role="application"
      :aria-label="
        t('tools.moldCut.moldAria', {
          w: modelValue.w,
          h: modelValue.h,
          x: modelValue.x,
          y: modelValue.y
        })
      "
    >
      <div
        class="absolute inset-0 border-2"
        :class="
          out ? 'border-dashed border-[var(--accent)]' : 'border-solid border-[var(--accent)]'
        "
      />
      <!-- 十字辅助线 -->
      <div class="absolute left-1/2 top-0 h-full w-px bg-[var(--accent)] opacity-40" />
      <div class="absolute left-0 top-1/2 h-px w-full bg-[var(--accent)] opacity-40" />
      <!-- 尺寸徽标：反缩放，屏幕尺寸恒定 -->
      <div
        class="absolute left-1/2 bottom-full mb-2 whitespace-nowrap rounded-md bg-[var(--board)] px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-[var(--ink)] border border-[var(--hairline)]"
        :style="{
          transform: `translateX(-50%) scale(${invScale})`,
          transformOrigin: 'bottom center'
        }"
      >
        {{ modelValue.w }} × {{ modelValue.h }}{{ out ? t('tools.moldCut.overflowSuffix') : '' }}
      </div>
      <!-- 缩放手柄：反缩放，屏幕尺寸恒定 -->
      <div
        v-for="h in HANDLES"
        :key="h.id"
        class="absolute w-3 h-3 rounded-[3px] bg-[var(--board)] border-2 border-[var(--accent)] touch-none select-none"
        :style="{
          left: h.x,
          top: h.y,
          transform: `translate(-50%, -50%) scale(${invScale})`,
          cursor: h.cursor
        }"
        @pointerdown="onHandleDown($event, h.id)"
        @pointermove="onHandleMove"
        @pointerup="onHandleUp"
        @pointercancel="onHandleUp"
      />
    </div>
  </div>
</template>
