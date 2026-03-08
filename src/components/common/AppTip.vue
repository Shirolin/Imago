<script setup lang="ts">
import type { Component } from 'vue'
import { Info } from 'lucide-vue-next'

interface Props {
  icon?: Component
}

defineProps<Props>()
</script>

<template>
  <div
    class="bg-primary/5 p-4 rounded-2xl flex items-center gap-3.5 text-muted-foreground text-[0.7rem] leading-relaxed border border-primary/10 transition-all hover:bg-primary/[0.08]"
  >
    <div
      class="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0"
    >
      <component :is="icon || Info" :size="16" />
    </div>
    <div class="flex-1 font-medium">
      <slot></slot>
    </div>
  </div>
</template>
