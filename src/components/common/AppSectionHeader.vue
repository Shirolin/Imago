<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  title: string
  icon?: Component
}

defineProps<Props>()
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div class="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
      <component v-if="icon" :is="icon" :size="14" stroke-width="2.5" />
    </div>
    <span class="font-black text-[0.7rem] text-muted-foreground uppercase tracking-[0.15em]">{{
      title
    }}</span>
  </div>
</template>
