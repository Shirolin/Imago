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
      return 'bg-primary/5 border-primary/20 shadow-sm shadow-primary/5 shadow-inner-glow'
    case 'muted':
      return 'bg-muted/5 border-border/40 shadow-inner-glow'
    case 'default':
    default:
      return 'bg-card border-border/60 shadow-sm shadow-inner-glow hover:border-primary/20 hover:shadow-md transition-all duration-300'
  }
})
</script>

<template>
  <div
    class="rounded-2xl p-4 md:p-5 border transition-all duration-300 overflow-hidden"
    :class="variantClasses"
  >
    <slot></slot>
  </div>
</template>
