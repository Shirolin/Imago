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
    'font-bold transition-all duration-300 whitespace-nowrap shrink-0 flex items-center justify-center '

  // 只有在使用 icon prop 或处于加载状态时才由组件自动添加 gap
  // 如果使用 #icon 插槽，建议使用者在插槽内自行处理间距或依赖父级的 flex
  if (props.icon || props.loading) {
    classes += 'gap-2 '
  }

  if (props.variant === 'link') {
    classes +=
      'p-0 h-auto text-primary hover:bg-transparent hover:underline shadow-none border-none active:scale-95 '
  } else {
    // 非 link 变体才应用这些样式
    if (props.variant === 'cta') {
      classes += 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 '
    }
    if (props.variant === 'primary') {
      classes += 'shadow-lg shadow-primary/20 hover:-translate-y-0.5 '
    }
    if (props.variant === 'tool') {
      classes += 'text-muted-foreground hover:bg-muted hover:text-primary '
    }
    if (props.variant === 'secondary') {
      classes +=
        'bg-secondary/20 border-border hover:border-primary hover:bg-secondary/40 hover:text-foreground text-foreground '
    }
    if (props.variant === 'danger') {
      classes +=
        'bg-destructive/10 text-destructive border-transparent hover:bg-destructive hover:text-destructive-foreground '
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
        v-if="icon && iconPosition === 'right' && !($slots.icon)"
        :is="icon"
        :size="iconSize"
        :class="iconClass"
        class="group-hover:translate-x-1"
      />
    </template>
  </Button>
</template>
