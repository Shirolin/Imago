<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: number
  label?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  snapValue?: number
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  unit: '%',
  ariaLabel: '滑动条'
})

const emit = defineEmits(['update:modelValue'])

const progressPercent = computed(() => {
  return ((props.modelValue - props.min) / (props.max - props.min)) * 100
})

const handleInput = (e: Event) => {
  let value = parseFloat((e.target as HTMLInputElement).value)
  if (props.snapValue !== undefined) {
    const threshold = (props.max - props.min) * 0.03
    if (Math.abs(value - props.snapValue) < threshold) value = props.snapValue
  }
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="flex flex-col gap-1.5 w-full group/slider">
    <!-- 文字标识层 -->
    <div v-if="label" class="flex justify-between items-center px-1">
      <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{{
        label
      }}</span>
      <span class="text-xs font-mono font-bold text-primary">{{ modelValue }}{{ unit }}</span>
    </div>

    <div class="relative h-6 flex items-center px-1">
      <!-- 轨道 -->
      <div
        class="absolute left-1 right-1 h-1 bg-muted/60 rounded-full border border-border/10 overflow-hidden"
      >
        <div
          class="h-full bg-primary/80 transition-[width] duration-75 ease-out shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>

      <!-- 原生滑块：纯净交互 -->
      <input
        type="range"
        :value="modelValue"
        @input="handleInput"
        :min="min"
        :max="max"
        :step="step"
        :aria-label="ariaLabel || label"
        class="absolute inset-0 w-full h-full bg-transparent appearance-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.15)] [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200 hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-125 active:[&::-webkit-slider-thumb]:bg-primary active:[&::-webkit-slider-thumb]:border-white"
      />
    </div>
  </div>
</template>

<style scoped>
/* Firefox 适配：同样移除位移，只保留缩放 */
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
input[type='range']:active::-moz-range-thumb {
  transform: scale(1.2);
  background: hsl(var(--primary));
  border-color: white;
}
</style>
