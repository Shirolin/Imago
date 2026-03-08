<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'tool' | 'cta'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false
})

const slots = useSlots()

const shadcnVariant = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'default'
    case 'secondary':
      return 'outline'
    case 'danger':
      return 'destructive'
    case 'ghost':
      return 'ghost'
    case 'tool':
      return 'ghost'
    case 'cta':
      return 'default'
    default:
      return 'default'
  }
})

const shadcnSize = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'sm'
    case 'md':
      return 'default'
    case 'lg':
      return 'lg'
    default:
      return 'default'
  }
})

const extraClasses = computed(() => {
  let classes = 'gap-2 font-bold transition-all duration-300 '
  if (props.variant === 'cta') {
    classes += 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 '
  }
  if (props.variant === 'primary') {
    classes += 'shadow-lg shadow-primary/20 hover:-translate-y-0.5 '
  }
  if (props.variant === 'tool') {
    classes += 'text-muted-foreground hover:bg-muted hover:text-primary rounded-xl '
  }
  if (props.variant === 'secondary') {
    classes += 'border-border hover:border-primary hover:bg-muted text-foreground rounded-xl '
  }
  return classes
})
</script>

<template>
  <Button
    :variant="shadcnVariant"
    :size="shadcnSize"
    :disabled="disabled || loading"
    :class="extraClasses"
  >
    <Loader2 v-if="loading" class="animate-spin" :size="16" />
    <slot v-else name="icon"></slot>
    <slot></slot>
  </Button>
</template>
