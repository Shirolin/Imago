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
        class="p-2 rounded-full bg-primary/10 text-primary shrink-0 flex items-center justify-center min-w-[32px] min-h-[32px]"
      >
        <component v-if="icon" :is="icon" :size="14" stroke-width="2.5" />
      </div>
      <span class="font-black text-[0.7rem] text-muted-foreground uppercase tracking-[0.15em]">{{
        title
      }}</span>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions"></slot>
    </div>
  </div>
</template>
