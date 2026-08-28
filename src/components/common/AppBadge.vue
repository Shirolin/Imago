<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'destructive' | 'muted' | 'success' | 'warning'
  icon?: Component
  label?: string
  iconSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'muted',
  iconSize: 10
})

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-primary/5 text-primary border-primary/20'
    case 'destructive':
      return 'bg-destructive/5 text-destructive border-destructive/20'
    case 'success':
      return 'bg-success/5 text-success border-success/20'
    case 'warning':
      return 'bg-warning/5 text-warning border-warning/20'
    case 'secondary':
      return 'bg-secondary/10 text-secondary-foreground border-[var(--hairline)]'
    case 'muted':
    default:
      return 'bg-muted/10 text-muted-foreground border-[var(--hairline)]'
  }
})
</script>

<template>
  <div
    class="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-ctrl)] text-[10px] font-medium leading-none border transition-colors"
    :class="variantClasses"
  >
    <component v-if="icon" :is="icon" :size="iconSize" />
    <span
      ><slot>{{ label }}</slot></span
    >
  </div>
</template>
