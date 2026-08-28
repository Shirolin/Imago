<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-vue-next'

interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'tool' | 'cta' | 'link' | 'success'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  icon?: Component
  iconPosition?: 'left' | 'right'
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  iconPosition: 'right'
})

const shadcnVariant = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'default'
    case 'secondary':
      return 'outline'
    case 'danger':
      return 'destructive'
    case 'success':
      return 'default'
    case 'ghost':
    case 'tool':
    case 'link':
      return 'ghost'
    case 'cta':
      return 'default'
    default:
      return 'default'
  }
})

const shadcnSize = computed(() => {
  if (props.variant === 'link') return 'sm'
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
  let classes =
    'transition-colors duration-150 whitespace-nowrap shrink-0 flex items-center justify-center select-none rounded-[var(--radius-ctrl)] '

  if (props.icon || props.loading) {
    classes += 'gap-2 '
  }

  if (props.variant === 'link') {
    classes +=
      'p-0 h-auto text-primary hover:bg-transparent hover:underline shadow-none border-none '
  } else if (
    props.variant === 'cta' ||
    props.variant === 'primary' ||
    props.variant === 'success'
  ) {
    classes +=
      'bg-[var(--accent)] text-[var(--board)] hover:brightness-95 shadow-none border-none disabled:opacity-45 '
  } else if (props.variant === 'tool') {
    classes += 'text-muted-foreground hover:bg-secondary hover:text-foreground '
  } else if (props.variant === 'secondary') {
    classes +=
      'bg-transparent border border-border hover:border-[var(--accent)] hover:text-foreground text-muted-foreground '
  } else if (props.variant === 'ghost') {
    classes +=
      'bg-transparent hover:bg-secondary border border-transparent text-muted-foreground hover:text-foreground '
  } else if (props.variant === 'danger') {
    classes += 'bg-[var(--danger)] text-[var(--board)] hover:brightness-95 border-none shadow-none '
  }
  return classes
})

const iconSize = computed(() => {
  switch (props.size) {
    case 'sm':
      return 14
    case 'lg':
      return 18
    default:
      return 16
  }
})

const iconClass = computed(() => {
  return ['shrink-0']
})
</script>

<template>
  <Button
    :variant="shadcnVariant"
    :size="shadcnSize"
    :disabled="disabled || loading"
    :class="extraClasses"
    :aria-label="ariaLabel"
  >
    <Loader2 v-if="loading" class="animate-spin shrink-0" :size="iconSize" />

    <slot name="icon" v-if="!loading">
      <component
        v-if="icon && iconPosition === 'left'"
        :is="icon"
        :size="iconSize"
        :class="iconClass"
      />
    </slot>
    <slot></slot>
    <component
      v-if="!loading && icon && iconPosition === 'right' && !$slots.icon"
      :is="icon"
      :size="iconSize"
      :class="iconClass"
    />
  </Button>
</template>
