<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'tool'
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

const classes = computed(() => [
  'app-btn',
  `variant-${props.variant}`,
  `size-${props.size}`,
  { 'is-loading': props.loading, 'is-disabled': props.disabled }
])
</script>

<template>
  <button :class="classes" :disabled="disabled || loading">
    <slot name="icon"></slot>
    <slot></slot>
  </button>
</template>

<style scoped>
.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 12px;
  font-weight: 600;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  border: 1px solid transparent;
  font-family: var(--font-body);
  user-select: none;
}

.size-sm { padding: 0.5rem 0.875rem; font-size: 0.8125rem; }
.size-md { padding: 0.625rem 1.25rem; font-size: 0.875rem; }
.size-lg { padding: 0.875rem 1.75rem; font-size: 1rem; }

.variant-primary {
  background: var(--accent-color);
  color: #FFFFFF;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.25);
}

.variant-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.1);
  box-shadow: 0 6px 16px rgba(34, 197, 94, 0.3);
}

.variant-secondary {
  background: var(--card-bg);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.variant-secondary:hover:not(:disabled) {
  background: var(--hover-bg);
  border-color: var(--text-secondary);
}

.variant-tool {
  background: transparent;
  color: var(--text-secondary);
  border-radius: 8px;
  padding: 0.5rem;
}

.variant-tool:hover:not(:disabled) {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.variant-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #EF4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.variant-danger:hover:not(:disabled) {
  background: #EF4444;
  color: white;
}

.app-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(1);
}

.app-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}
</style>
