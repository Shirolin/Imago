<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  title: string
  icon?: Component
}

defineProps<Props>()
</script>

<template>
  <div class="flex items-center justify-between gap-4 min-w-0">
    <div class="flex items-center gap-2 min-w-0">
      <component
        v-if="icon"
        :is="icon"
        :size="14"
        stroke-width="2"
        class="text-[var(--muted)] shrink-0"
      />
      <span class="font-medium text-sm text-[var(--ink)] truncate" :title="title">{{ title }}</span>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
      <slot name="actions"></slot>
    </div>
  </div>
</template>
