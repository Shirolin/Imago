<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
import { containMold, isOutOfBounds, type MoldRect } from '../../lib/moldCut'

interface Props {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  modelValue: MoldRect
  /** 工作台缩放，用于把屏幕位移换算回原图像素 */
  scale?: number
}

const props = withDefaults(defineProps<Props>(), { scale: 1 })
const emit = defineEmits<{
  (e: 'update:modelValue', value: MoldRect): void
  (e: 'change', value: MoldRect): void
}>()

const dragging = ref(false)
let startClient = { x: 0, y: 0 }
let startMold = { x: 0, y: 0 }

const out = computed(() => isOutOfBounds(props.modelValue, props.imageWidth, props.imageHeight))

const onPointerDown = (e: PointerEvent) => {
  if (e.button !== 0 || e.altKey) return
  e.stopPropagation()
  e.preventDefault()
  dragging.value = true
  startClient = { x: e.clientX, y: e.clientY }
  startMold = { x: props.modelValue.x, y: props.modelValue.y }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

const onPointerMove = (e: PointerEvent) => {
  if (!dragging.value) return
  const next = containMold(
    {
      ...props.modelValue,
      x: Math.round(startMold.x + (e.clientX - startClient.x) / props.scale),
      y: Math.round(startMold.y + (e.clientY - startClient.y) / props.scale)
    },
    props.imageWidth,
    props.imageHeight
  )
  emit('update:modelValue', next)
}

const onPointerUp = (e: PointerEvent) => {
  if (!dragging.value) return
  dragging.value = false
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    /* 忽略重复释放 */
  }
  emit('change', props.modelValue)
}
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
      :class="dragging ? 'cursor-grabbing' : 'cursor-move'"
      :style="{
        left: modelValue.x + 'px',
        top: modelValue.y + 'px',
        width: modelValue.w + 'px',
        height: modelValue.h + 'px',
        boxShadow: '0 0 0 9999px rgba(20, 20, 19, 0.45)'
      }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
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
      <!-- 尺寸徽标 -->
      <div
        class="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--board)] px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-[var(--ink)] border border-[var(--hairline)]"
      >
        {{ modelValue.w }} × {{ modelValue.h }}{{ out ? t('tools.moldCut.overflowSuffix') : '' }}
      </div>
    </div>
  </div>
</template>
