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
  <div class="flex flex-col gap-2 w-full group/slider select-none">
    <!-- 文字标识层：显式确保可见性 -->
    <div v-if="label" class="flex justify-between items-center px-1 min-h-[14px]">
      <span
        class="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none"
        >{{ label }}</span
      >
      <span class="text-[11px] font-mono font-black text-primary leading-none"
        >{{ modelValue }}{{ unit }}</span
      >
    </div>

    <div class="relative h-6 flex items-center px-1">
      <!-- 轨道 -->
      <div
        class="absolute left-1 right-1 h-1.5 bg-muted/40 rounded-full border border-border/5 overflow-hidden"
      >
        <div
          class="h-full bg-primary transition-[width] duration-100 ease-out shadow-[0_0_15px_hsl(var(--primary)/0.4)]"
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>

      <!-- 原生滑块 -->
      <input
        type="range"
        :value="modelValue"
        @input="handleInput"
        :min="min"
        :max="max"
        :step="step"
        :aria-label="ariaLabel || label"
        class="absolute inset-0 w-full h-full bg-transparent appearance-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full z-20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:shadow-[0_2px_10px_rgba(0,0,0,0.2)] [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200 hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-125 active:[&::-webkit-slider-thumb]:bg-primary active:[&::-webkit-slider-thumb]:border-white"
      />
    </div>
  </div>
</template>

<style scoped>
/* Firefox 适配 */
input[type='range']::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: white;
  border: 2px solid hsl(var(--primary));
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}
input[type='range']:active::-moz-range-thumb {
  transform: scale(1.2);
  background: hsl(var(--primary));
  border-color: white;
}
</style>
