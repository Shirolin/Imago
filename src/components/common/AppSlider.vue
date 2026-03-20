<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  modelValue: number
  label?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  snapValue?: number // 新增：磁吸目标值 (Delight: Snap Feedback)
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  unit: '%'
})

const emit = defineEmits(['update:modelValue'])

const isDragging = ref(false)

// 唯一 ID (Harden: A11y)
const sliderId = `slider-${Math.random().toString(36).slice(2, 9)}`

const progressPercent = computed(() => {
  return ((props.modelValue - props.min) / (props.max - props.min)) * 100
})

const handleInput = (e: Event) => {
  let value = parseFloat((e.target as HTMLInputElement).value)

  // 智能磁吸逻辑 (Delight: Soft Snapping)
  if (props.snapValue !== undefined) {
    const threshold = (props.max - props.min) * 0.03 // 3% 的捕捉范围
    if (Math.abs(value - props.snapValue) < threshold) {
      value = props.snapValue
    }
  }

  emit('update:modelValue', value)
}

const handleNumberInput = (e: Event) => {
  let value = parseFloat((e.target as HTMLInputElement).value)
  if (isNaN(value)) return
  // 边界约束 (Hardening)
  value = Math.max(props.min, Math.min(props.max, value))
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="flex flex-col gap-1.5 group/slider">
    <!-- 头部信息 (如果外部没传 Header，内部提供基础版) -->
    <div v-if="label" class="flex items-center justify-between mb-0.5 px-0.5">
      <label
        :for="sliderId"
        class="text-[0.65rem] font-bold text-muted-foreground/80 uppercase tracking-widest cursor-pointer truncate"
        >{{ label }}</label
      >

      <!-- 数值显示/自定义插槽 -->
      <slot v-if="$slots.default" :modelValue="modelValue"></slot>
      <div
        v-else
        class="flex items-center bg-muted/30 border border-border/20 rounded-lg px-1.5 py-0.5 focus-within:border-primary/40 focus-within:bg-muted/50 transition-all"
      >
        <input
          :id="sliderId"
          type="number"
          :value="modelValue"
          @input="handleNumberInput"
          :min="min"
          :max="max"
          :step="step"
          class="w-10 bg-transparent border-none outline-none text-[0.65rem] font-black text-foreground tabular-nums text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span class="text-[0.55rem] font-bold text-muted-foreground/40 ml-1 select-none">{{
          unit
        }}</span>
      </div>
    </div>

    <!-- 插槽：由外部定义更复杂的 Header -->
    <div class="relative z-10">
      <slot name="header"></slot>
    </div>

    <!-- 滑块交互区 (Normalize: 增加内边距补偿手柄半宽溢出) -->
    <div class="relative flex items-center h-5 px-2.5 z-0">
      <!-- 背景轨道 -->
      <div
        class="absolute left-2.5 right-2.5 top-1/2 -translate-y-1/2 h-1 bg-muted/60 rounded-full overflow-hidden border border-border/10"
      >
        <!-- 已填充进度条 (Delightful Fill) -->
        <div
          class="h-full bg-primary/80 transition-[width] duration-75 ease-out shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>

      <!-- 原生滑块覆盖层 -->
      <input
        type="range"
        :value="modelValue"
        @input="handleInput"
        @mousedown="isDragging = true"
        @mouseup="isDragging = false"
        @touchstart="isDragging = true"
        @touchend="isDragging = false"
        :min="min"
        :max="max"
        :step="step"
        :aria-label="label || '调节器'"
        class="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-full bg-transparent appearance-none cursor-pointer z-10 outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.15)] [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200 hover:[&::-webkit-slider-thumb]:scale-110 hover:[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_hsl(var(--primary)/0.15)] active:[&::-webkit-slider-thumb]:scale-125 active:[&::-webkit-slider-thumb]:bg-primary active:[&::-webkit-slider-thumb]:border-white active:[&::-webkit-slider-thumb]:shadow-[0_0_0_6px_hsl(var(--primary)/0.25)]"
      />
    </div>
  </div>
</template>

<style scoped>
/* 确保滑块在 Firefox 下也有良好表现 */
input[type='range']::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: white;
  border: 2px solid hsl(var(--primary));
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
input[type='range']:hover::-moz-range-thumb {
  transform: scale(1.1);
  box-shadow: 0 0 0 4px hsla(var(--primary) / 0.15);
}
input[type='range']:active::-moz-range-thumb {
  transform: scale(0.9);
  background: hsl(var(--primary));
  border-color: white;
}
</style>
