<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  title: string
  icon?: Component
}

defineProps<Props>()
</script>

<template>
  <div class="flex items-center gap-2 font-bold text-[0.85rem] text-foreground uppercase">
    <component v-if="icon" :is="icon" :size="18" class="text-primary" />
    <span>{{ title }}</span>
  </div>
</template>
