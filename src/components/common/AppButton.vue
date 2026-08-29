<script setup lang="ts">
import { computed, useAttrs, useSlots } from 'vue'
import type { Component } from 'vue'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { clsx, type ClassValue } from 'clsx'

interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'tool' | 'cta' | 'link' | 'success'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  icon?: Component
  iconPosition?: 'left' | 'right'
  ariaLabel?: string
  /** Allow label to wrap up to two lines inside full-width inspector CTAs */
  fill?: boolean
  /** Secondary line shown below the label (e.g. click-to-abort hint) */
  hint?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  iconPosition: 'right',
  fill: false
})

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const slots = useSlots()

const className = computed(() => clsx(attrs.class as ClassValue))
const hasLabel = computed(() => typeof slots.default === 'function')

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

const toneClasses = computed(() => {
  if (props.variant === 'link') {
    return 'p-0 h-auto text-primary hover:bg-transparent hover:underline shadow-none border-none'
  }
  if (props.variant === 'cta' || props.variant === 'primary' || props.variant === 'success') {
    return 'bg-[var(--accent)] text-[var(--on-product)] hover:bg-[var(--accent-press)] shadow-none border-none disabled:opacity-45'
  }
  if (props.variant === 'tool') {
    return 'text-muted-foreground hover:bg-secondary hover:text-foreground'
  }
  if (props.variant === 'secondary') {
    return 'bg-transparent border border-border hover:border-[var(--accent)] hover:text-foreground text-muted-foreground'
  }
  if (props.variant === 'ghost') {
    return 'bg-transparent hover:bg-secondary border border-transparent text-muted-foreground hover:text-foreground'
  }
  if (props.variant === 'danger') {
    return 'bg-[var(--danger)] text-[var(--on-product)] hover:brightness-95 border-none shadow-none'
  }
  return ''
})

const extraClasses = computed(() =>
  cn(
    className.value,
    'transition-colors duration-150 flex items-center justify-center select-none rounded-[var(--radius-ctrl)]',
    (props.icon || props.loading) && hasLabel.value ? 'gap-2' : '',
    toneClasses.value,
    props.fill
      ? 'min-w-0 shrink h-auto min-h-11 whitespace-normal text-center leading-snug py-2 [overflow-wrap:break-word]'
      : 'whitespace-nowrap shrink-0'
  )
)

const forwardedAttrs = computed(() => {
  const { class: _className, 'aria-label': _ariaLabel, ...rest } = attrs as Record<string, unknown>
  return rest
})

const baseAriaLabel = computed(() => props.ariaLabel || (attrs['aria-label'] as string | undefined))

const resolvedAriaLabel = computed(() => {
  if (!props.hint) return baseAriaLabel.value
  if (baseAriaLabel.value) return `${baseAriaLabel.value} ${props.hint}`
  return undefined
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
    v-bind="forwardedAttrs"
    :variant="shadcnVariant"
    :size="shadcnSize"
    :disabled="disabled || loading"
    :class="extraClasses"
    :aria-label="resolvedAriaLabel"
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
    <span
      v-if="hasLabel || hint"
      class="min-w-0"
      :class="fill ? 'max-w-full [overflow-wrap:break-word]' : ''"
    >
      <slot></slot>
      <span v-if="hint" class="mt-0.5 block text-[11px] font-normal opacity-70">{{ hint }}</span>
    </span>
    <component
      v-if="!loading && icon && iconPosition === 'right' && !$slots.icon"
      :is="icon"
      :size="iconSize"
      :class="iconClass"
    />
  </Button>
</template>
