<script setup lang="ts">
import { useImageStore } from '../../stores/imageStore'
import { Square, CheckSquare } from 'lucide-vue-next'

const store = useImageStore()
</script>

<template>
  <div
    class="flex items-center gap-3.5 cursor-pointer px-5 h-11 rounded-full bg-muted/40 border border-border/50 transition-all duration-300 hover:border-primary/50 hover:bg-background hover:-translate-y-[1px] active:scale-[0.96] group shrink-0"
    @click="store.toggleAll"
  >
    <div
      class="flex items-center justify-center transition-colors duration-200"
      :class="
        store.isAllSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
      "
    >
      <CheckSquare v-if="store.isAllSelected" :size="18" class="drop-shadow-sm" />
      <Square v-else :size="18" />
    </div>
    <div class="flex flex-col justify-center">
      <span class="font-bold text-[0.8rem] text-foreground leading-none tracking-tight">
        已选择 {{ store.selectedCount }}
        <span v-if="store.images.length > 0">/ {{ store.images.length }}</span>
      </span>
      <span
        class="hidden md:inline text-[0.6rem] text-muted-foreground font-black uppercase tracking-[0.1em] mt-0.5 opacity-60 leading-none"
      >
        全选/反选
      </span>
    </div>
  </div>
</template>
