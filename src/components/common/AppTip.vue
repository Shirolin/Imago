<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 为 true 时作为 live region，供读屏在内容出现时播报（如 GIF 提示） */
    status?: boolean
  }>(),
  {
    status: false
  }
)
</script>

<template>
  <p
    class="text-[11px] text-[var(--muted)] leading-relaxed"
    :role="status ? 'status' : undefined"
    :aria-live="status ? 'polite' : undefined"
  >
    <slot></slot>
  </p>
</template>
