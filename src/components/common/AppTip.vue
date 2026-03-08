<script setup lang="ts">
import type { Component } from 'vue'
import { Zap } from 'lucide-vue-next'

interface Props {
  icon?: Component
}

defineProps<Props>()
</script>

<template>
  <div
    class="bg-green-500/5 p-4 rounded-xl flex gap-3 text-muted-foreground text-xs leading-relaxed border border-dashed border-primary/30"
  >
    <component :is="icon || Zap" :size="16" class="text-primary shrink-0" />
    <div>
      <slot></slot>
    </div>
  </div>
</template>
