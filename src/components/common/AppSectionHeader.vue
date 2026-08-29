<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  title: string
  icon?: Component
}

defineProps<Props>()
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-2">
      <component
        v-if="icon"
        :is="icon"
        :size="14"
        stroke-width="2"
        class="text-[var(--muted)] shrink-0"
      />
      <span class="font-medium text-sm text-[var(--ink)]">{{ title }}</span>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions"></slot>
    </div>
  </div>
</template>
