<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  label: string
  value?: string | number
  icon?: Component
  iconSize?: number
  mono?: boolean
}

withDefaults(defineProps<Props>(), {
  iconSize: 14,
  mono: false
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div
      class="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest leading-none px-0.5"
    >
      {{ label }}
    </div>
    <div
      class="flex items-center gap-2 text-sm font-semibold text-foreground"
      :class="{ 'font-mono font-bold': mono }"
    >
      <component v-if="icon" :is="icon" :size="iconSize" class="text-primary shrink-0" />
      <slot>{{ value }}</slot>
    </div>
  </div>
</template>
