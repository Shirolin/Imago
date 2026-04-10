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
      return 'bg-primary/5 border-primary/20'
    case 'muted':
      return 'bg-muted/5 border-border/40'
    case 'default':
    default:
      return 'bg-muted/10 border-border/60'
  }
})
</script>

<template>
  <div
    class="rounded-2xl p-4 border transition-all duration-300 overflow-hidden"
    :class="variantClasses"
  >
    <slot></slot>
  </div>
</template>
