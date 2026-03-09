<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'tool' | 'cta' | 'link'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  icon?: Component
  iconPosition?: 'left' | 'right'
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
    'font-bold transition-all duration-300 whitespace-nowrap shrink-0 flex items-center justify-center select-none active:scale-[0.97] '

  if (props.icon || props.loading) {
    classes += 'gap-2.5 '
  }

  if (props.variant === 'link') {
    classes +=
      'p-0 h-auto text-primary hover:bg-transparent hover:underline shadow-none border-none '
  } else {
    // 物理一致性：统一的悬停位移
    classes += 'hover:translate-y-[var(--button-hover-offset)] '

    if (props.variant === 'cta') {
      classes +=
        'bg-[hsl(var(--cta))] hover:bg-[hsl(32,95%,55%)] text-white shadow-[0_10px_20px_-5px_hsla(var(--cta),var(--button-shadow-opacity))] hover:shadow-[0_15px_30px_-5px_hsla(var(--cta),0.4)] '
    }
    if (props.variant === 'primary') {
      classes +=
        'bg-primary text-primary-foreground shadow-[0_10px_20px_-5px_hsla(var(--primary),var(--button-shadow-opacity))] hover:shadow-[0_15px_30px_-5px_hsla(var(--primary),0.4)] '
    }
    if (props.variant === 'tool') {
      classes += 'text-muted-foreground hover:bg-muted hover:text-primary '
    }
    if (props.variant === 'secondary') {
      classes +=
        'bg-secondary/40 border border-border/60 hover:border-primary/40 hover:bg-secondary/60 hover:text-foreground text-foreground '
    }
    if (props.variant === 'danger') {
      classes +=
        'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white '
    }
  }
  return classes
})

const iconSize = computed(() => {
  switch (props.size) {
    case 'sm':
      return 14
    case 'lg':
      return 20
    default:
      return 18
  }
})

// 依靠高质量字体（Inter + Noto Sans SC）实现自然的视觉对齐。
// 移除所有手动的 Optical Bias 补丁，回归标准的 Flex 垂直居中。
const iconClass = computed(() => {
  return ['shrink-0 transition-transform duration-300']
})
</script>

<template>
  <Button
    :variant="shadcnVariant"
    :size="shadcnSize"
    :disabled="disabled || loading"
    :class="extraClasses"
  >
    <Loader2 v-if="loading" class="animate-spin shrink-0" :size="iconSize" />
    <template v-else>
      <slot name="icon">
        <component
          v-if="icon && iconPosition === 'left'"
          :is="icon"
          :size="iconSize"
          :class="iconClass"
        />
      </slot>
      <slot></slot>
      <component
        v-if="icon && iconPosition === 'right' && !$slots.icon"
        :is="icon"
        :size="iconSize"
        :class="iconClass"
        class="group-hover:translate-x-1"
      />
    </template>
  </Button>
</template>
