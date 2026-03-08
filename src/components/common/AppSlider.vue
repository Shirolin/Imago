<script setup lang="ts">
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

withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  unit: ''
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between text-[0.7rem] font-bold text-muted-foreground">
      <div class="flex items-center gap-1.5">
        <component v-if="icon" :is="icon" :size="14" />
        <span>{{ label }}</span>
      </div>
      <slot :modelValue="modelValue">
        <span class="text-primary">{{ modelValue }}{{ unit }}</span>
      </slot>
    </div>
    <input
      type="range"
      :value="modelValue"
      @input="$emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
      :min="min"
      :max="max"
      :step="step"
      class="w-full h-1 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer shadow-[0_0_0_2px_hsl(var(--card))] border-none focus:outline-none"
    />
  </div>
</template>
