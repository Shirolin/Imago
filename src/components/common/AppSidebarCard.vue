<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'primary' | 'muted'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default'
})

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--chrome))] border-[color-mix(in_srgb,var(--accent)_35%,transparent)]'
    case 'muted':
      return 'bg-transparent border-[color-mix(in_srgb,var(--ink)_10%,transparent)]'
    case 'default':
    default:
      return 'bg-transparent border-[color-mix(in_srgb,var(--ink)_10%,transparent)]'
  }
})
</script>

<template>
  <div class="rounded-[var(--radius)] p-3 border overflow-hidden" :class="variantClasses">
    <slot></slot>
  </div>
</template>
