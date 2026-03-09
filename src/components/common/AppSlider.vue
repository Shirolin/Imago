<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Component } from 'vue'

interface Props {
  modelValue: number
  label: string
  min?: number
  max?: number
  step?: number
  unit?: string
  icon?: Component
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  unit: ''
})

const emit = defineEmits(['update:modelValue'])

const isDragging = ref(false)

const progressPercent = computed(() => {
  return ((props.modelValue - props.min) / (props.max - props.min)) * 100
})

const handleInput = (e: Event) => {
  const value = Number((e.target as HTMLInputElement).value)
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="flex flex-col gap-3 group/slider">
    <div
      class="flex items-center justify-between text-[0.65rem] font-black text-muted-foreground uppercase tracking-widest px-0.5 transition-colors group-hover/slider:text-foreground"
    >
      <div class="flex items-center gap-2">
        <component
          v-if="icon"
          :is="icon"
          :size="12"
          class="opacity-60 group-hover/slider:text-primary group-hover/slider:opacity-100 transition-all"
        />
        <span class="opacity-80 group-hover/slider:opacity-100">{{ label }}</span>
      </div>
      <div
        class="transition-transform duration-300"
        :class="{ 'scale-110 text-primary': isDragging }"
      >
        <slot :modelValue="modelValue">
          <span class="font-mono text-[0.75rem] font-black text-primary"
            >{{ modelValue }}{{ unit }}</span
          >
        </slot>
      </div>
    </div>

    <div class="relative flex items-center h-5">
      <!-- 背景轨道 -->
      <div
        class="absolute w-full h-1 bg-muted/60 rounded-full overflow-hidden border border-border/10 shadow-inner"
      >
        <!-- 已填充进度条 (Delightful Fill) -->
        <div
          class="h-full bg-primary/80 transition-[width] duration-75 ease-out shadow-[0_0_10px_rgba(var(--primary),0.3)]"
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
        class="absolute w-full h-full bg-transparent appearance-none cursor-pointer z-10 outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.15)] [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200 hover:[&::-webkit-slider-thumb]:scale-110 hover:[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_hsla(var(--primary)/0.15)] active:[&::-webkit-slider-thumb]:scale-90 active:[&::-webkit-slider-thumb]:bg-primary active:[&::-webkit-slider-thumb]:border-white active:[&::-webkit-slider-thumb]:shadow-[0_0_0_6px_hsla(var(--primary)/0.25)]"
      />
    </div>
  </div>
</template>

<style scoped>
/* 针对 Firefox 的滑块样式适配 */
input[type='range']::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  border: 2px solid hsl(var(--primary));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
  cursor: pointer;
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
