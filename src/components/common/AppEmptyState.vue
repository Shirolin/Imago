<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  title: string
  description?: string
  icon?: Component
}

defineProps<Props>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center py-24 md:py-32 animate-in fade-in duration-700 text-center"
  >
    <div v-if="icon" class="bg-muted/30 p-8 rounded-full mb-6">
      <component :is="icon" :size="48" class="text-muted-foreground/40" />
    </div>
    <p class="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">
      {{ title }}
    </p>
    <p v-if="description" class="text-[11px] font-medium text-muted-foreground/40 max-w-[280px]">
      {{ description }}
    </p>
  </div>
</template>
