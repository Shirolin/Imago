<script setup lang="ts">
import type { Component } from 'vue'

interface Option {
  label: string
  value: string | number | boolean
  icon?: Component
}

interface Props {
  modelValue: string | number | boolean
  options: Option[]
  ariaLabel?: string
}

defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const select = (value: string | number | boolean) => {
  emit('update:modelValue', value)
}
</script>

<template>
  <div
    class="flex bg-muted p-1 rounded-xl border border-border"
    role="radiogroup"
    :aria-label="ariaLabel"
  >
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.value"
      class="flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-muted"
      :class="
        modelValue === option.value
          ? 'bg-card text-primary shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      "
      @click="select(option.value)"
    >
      <component v-if="option.icon" :is="option.icon" :size="16" />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>
