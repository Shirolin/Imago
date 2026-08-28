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
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <p class="text-sm font-medium text-[var(--ink-well)] mb-1">
      {{ title }}
    </p>
    <p v-if="description" class="text-[13px] text-[var(--muted)] max-w-[280px]">
      {{ description }}
    </p>
  </div>
</template>
