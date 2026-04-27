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
    <div class="flex items-center gap-2.5">
      <div
        class="p-1.5 rounded-lg bg-primary/5 text-primary/80 shrink-0 flex items-center justify-center min-w-[28px] min-h-[28px] border border-primary/10"
      >
        <component v-if="icon" :is="icon" :size="14" stroke-width="2" />
      </div>
      <span class="font-semibold text-sm text-foreground/90 tracking-tight">{{ title }}</span>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions"></slot>
    </div>
  </div>
</template>
