<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
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
/** 移动命中垫：画布像素，保证小模具也有可抓区域（屏幕约 8px） */
const hitPad = computed(() => Math.min(32, 8 / (props.scale || 1)))

const out = computed(() => isOutOfBounds(props.modelValue, props.imageWidth, props.imageHeight))

// --- 手势：窗口级 move/up，不依赖元素捕获，拖出小模具也不丢 ---
interface Gesture {
  type: 'move' | 'resize'
  handle?: MoldHandle
  startClient: { x: number; y: number }
  startRect: MoldRect
}

const moving = ref(false)
const resizing = ref<MoldHandle | null>(null)
let gesture: Gesture | null = null

const endGesture = () => {
  if (!gesture) return
  gesture = null
  moving.value = false
  resizing.value = null
  window.removeEventListener('pointermove', onWindowMove)
  window.removeEventListener('pointerup', onWindowUp)
  window.removeEventListener('pointercancel', onWindowUp)
  emit('change', props.modelValue)
}

const onWindowMove = (e: PointerEvent) => {
  if (!gesture) return
  const dx = (e.clientX - gesture.startClient.x) / props.scale
  const dy = (e.clientY - gesture.startClient.y) / props.scale
  if (gesture.type === 'move') {
    emit(
      'update:modelValue',
      containMold(
        {
          ...gesture.startRect,
          x: Math.round(gesture.startRect.x + dx),
          y: Math.round(gesture.startRect.y + dy)
        },
        props.imageWidth,
        props.imageHeight
      )
    )
  } else if (gesture.handle) {
    emit(
      'update:modelValue',
      resizeMold(gesture.startRect, gesture.handle, dx, dy, props.preserveRatio)
    )
  }
}

const onWindowUp = () => endGesture()

const beginGesture = (e: PointerEvent, g: Gesture) => {
  if (e.button !== 0 || e.altKey) return
  e.stopPropagation()
  e.preventDefault()
  endGesture()
  gesture = g
  moving.value = g.type === 'move'
  resizing.value = g.type === 'resize' ? (g.handle ?? null) : null
  window.addEventListener('pointermove', onWindowMove)
  window.addEventListener('pointerup', onWindowUp)
  window.addEventListener('pointercancel', onWindowUp)
}

const onMoveDown = (e: PointerEvent) =>
  beginGesture(e, {
    type: 'move',
    startClient: { x: e.clientX, y: e.clientY },
    startRect: { ...props.modelValue }
  })

const onHandleDown = (e: PointerEvent, handle: MoldHandle) =>
  beginGesture(e, {
    type: 'resize',
    handle,
    startClient: { x: e.clientX, y: e.clientY },
    startRect: { ...props.modelValue }
  })

onUnmounted(() => {
  gesture = null
  window.removeEventListener('pointermove', onWindowMove)
  window.removeEventListener('pointerup', onWindowUp)
  window.removeEventListener('pointercancel', onWindowUp)
})

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
      data-testid="mold-frame"
      :style="{
        left: modelValue.x + 'px',
        top: modelValue.y + 'px',
        width: modelValue.w + 'px',
        height: modelValue.h + 'px',
        boxShadow: '0 0 0 9999px rgba(20, 20, 19, 0.45)',
        cursor: activeCursor
      }"
      @pointerdown="onMoveDown"
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
      <!-- 移动命中垫：透明扩大可抓区，手柄在其之上 -->
      <div class="absolute" data-testid="mold-hitpad" :style="{ inset: -hitPad + 'px' }" />
      <div
        class="absolute inset-0 border-2 pointer-events-none"
        :class="
          out ? 'border-dashed border-[var(--accent)]' : 'border-solid border-[var(--accent)]'
        "
      />
      <!-- 十字辅助线 -->
      <div
        class="absolute left-1/2 top-0 h-full w-px bg-[var(--accent)] opacity-40 pointer-events-none"
      />
      <div
        class="absolute left-0 top-1/2 h-px w-full bg-[var(--accent)] opacity-40 pointer-events-none"
      />
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
        :data-testid="`mold-handle-${h.id}`"
        class="absolute w-3 h-3 rounded-[3px] bg-[var(--board)] border-2 border-[var(--accent)] touch-none select-none"
        :style="{
          left: h.x,
          top: h.y,
          transform: `translate(-50%, -50%) scale(${invScale})`,
          cursor: h.cursor
        }"
        @pointerdown="onHandleDown($event, h.id)"
      />
    </div>
  </div>
</template>
