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
    <div class="text-[11px] font-medium text-muted-foreground leading-none px-0.5">
      {{ label }}
    </div>
    <div
      class="flex items-center gap-2 text-sm font-semibold text-[var(--accent)] tabular-spec"
      :class="{ 'tabular-spec': mono }"
    >
      <component v-if="icon" :is="icon" :size="iconSize" class="text-primary shrink-0" />
      <slot>{{ value }}</slot>
    </div>
  </div>
</template>
