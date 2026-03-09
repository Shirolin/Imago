<script setup lang="ts">
import { computed } from 'vue'
import { useImageStore } from '../../stores/imageStore'
import { Square, CheckSquare, CheckCircle2 } from 'lucide-vue-next'
import { useBreakpoints } from '../../composables/useBreakpoints'

const store = useImageStore()
const { isPC } = useBreakpoints()

const isAllDone = computed(() => {
  return store.images.length > 0 && store.images.every((img) => img.status === 'done')
})
</script>

<template>
  <div
    class="relative flex items-center gap-3 md:gap-4 cursor-pointer px-4 md:px-6 h-10 md:h-12 rounded-full border transition-all duration-500 hover:-translate-y-0.5 active:scale-[0.96] group shrink-0 select-none overflow-hidden"
    :class="[
      isAllDone
        ? 'bg-primary/[0.03] border-primary/30 shadow-primary'
        : 'bg-muted/40 border-border/50 hover:border-primary/40 hover:bg-background shadow-soft hover:shadow-elevated'
    ]"
    @click="store.toggleAll"
  >
    <!-- 成功状态的扩散背景 (Success Ripple) -->
    <div
      v-if="isAllDone"
      class="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none"
    ></div>

    <div
      class="flex items-center justify-center transition-all duration-300 relative z-10"
      :class="[
        isAllDone
          ? 'text-primary scale-110'
          : store.isAllSelected
            ? 'text-primary'
            : 'text-muted-foreground group-hover:text-foreground'
      ]"
    >
      <CheckCircle2
        v-if="isAllDone"
        :size="20"
        class="drop-shadow-[0_0_8px_rgba(var(--primary),0.4)]"
        stroke-width="2.5"
      />
      <CheckSquare v-else-if="store.isAllSelected" :size="20" class="drop-shadow-sm" />
      <Square v-else :size="20" stroke-width="2.5" />
    </div>

    <div class="flex flex-col justify-center relative z-10">
      <div class="flex items-center gap-1.5">
        <span
          class="font-black text-[0.85rem] md:text-[0.95rem] text-foreground leading-none tracking-tight transition-colors"
          :class="{ 'text-primary': isAllDone }"
        >
          <span v-if="isPC">已选择 </span>
          {{ store.selectedCount }}
          <span v-if="store.images.length > 0" class="opacity-30">/ {{ store.images.length }}</span>
        </span>
        <div
          v-if="isAllDone"
          class="px-1.5 py-0.5 rounded-sm bg-primary text-white text-[0.6rem] font-black uppercase tracking-widest animate-in fade-in zoom-in duration-500"
        >
          Ready
        </div>
      </div>
      <span
        v-if="isPC"
        class="text-[0.65rem] font-black uppercase tracking-[0.2em] mt-0.5 opacity-40 leading-none group-hover:opacity-80 transition-opacity"
      >
        {{ isAllDone ? 'Processing Complete' : 'Toggle Selection' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.shadow-primary {
  box-shadow:
    0 10px 15px -3px hsla(var(--primary) / 0.15),
    0 4px 6px -2px hsla(var(--primary) / 0.1);
}
</style>
