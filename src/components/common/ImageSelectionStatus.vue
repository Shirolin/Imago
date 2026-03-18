<script setup lang="ts">
import { computed } from 'vue'
import { useImageStore } from '../../stores/imageStore'
import { Square, CheckSquare, CheckCircle2, LayoutGrid, Maximize2 } from 'lucide-vue-next'
import { useBreakpoints } from '../../composables/useBreakpoints'
import { useLayoutStore } from '../../stores/layoutStore'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { isPC } = useBreakpoints()

const isAllDone = computed(() => {
  return store.images.length > 0 && store.images.every((img) => img.status === 'done')
})
</script>

<template>
  <div class="flex items-center gap-2">
    <div
      class="relative flex items-center cursor-pointer transition-all duration-500 hover:-translate-y-0.5 active:scale-[0.96] group shrink-0 select-none overflow-hidden"
      :class="[
        isAllDone
          ? 'bg-primary/[0.03] border-primary/30 shadow-primary'
          : 'bg-muted/40 border-border/50 hover:border-primary/40 hover:bg-background shadow-soft hover:shadow-elevated',
        isPC ? 'px-5 h-11 rounded-2xl border gap-4' : 'px-3 h-10 rounded-xl border gap-2.5'
      ]"
      @click="store.toggleAll"
    >
      <!-- 成功状态的扩散背景 (Success Ripple) -->
      <div
        v-if="isAllDone"
        class="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none"
      ></div>

      <!-- 图标区 -->
      <div
        class="flex items-center justify-center transition-all duration-300 relative z-10"
        :class="[
          isAllDone
            ? 'text-primary scale-110'
            : store.isAllSelected
              ? 'text-primary'
              : 'text-muted-foreground group-hover:text-primary/80'
        ]"
      >
        <CheckCircle2
          v-if="isAllDone"
          :size="isPC ? 20 : 18"
          class="drop-shadow-[0_0_8px_rgba(var(--primary),0.4)]"
          stroke-width="2.5"
        />
        <CheckSquare
          v-else-if="store.isAllSelected"
          :size="isPC ? 20 : 18"
          class="drop-shadow-sm"
        />
        <Square v-else :size="isPC ? 20 : 18" stroke-width="2.5" />
      </div>

      <!-- 文字区 -->
      <div class="flex flex-col justify-center relative z-10 min-w-0">
        <div class="flex items-center gap-1.5 md:gap-2">
          <span
            class="font-black text-muted-foreground leading-none tracking-tight transition-colors whitespace-nowrap"
            :class="[isPC ? 'text-[0.95rem]' : 'text-[0.85rem]', { 'text-primary/80': isAllDone }]"
          >
            <span v-if="isPC">已选择 </span>
            <span class="font-mono">{{ store.selectedCount }}</span>
            <span v-if="store.images.length > 0" class="opacity-30 mx-0.5">/</span>
            <span v-if="store.images.length > 0" class="opacity-30 font-mono">{{
              store.images.length
            }}</span>
          </span>

          <!-- Ready 状态标签 (仅在 PC 或全选完成时展示) -->
          <div
            v-if="isAllDone"
            class="px-1.5 py-0.5 rounded bg-primary text-white text-[0.6rem] font-black uppercase tracking-widest animate-in fade-in zoom-in duration-500 hidden sm:block"
          >
            Ready
          </div>
        </div>

        <!-- 副标题 (仅 PC 展示) -->
        <span
          v-if="isPC"
          class="text-[0.6rem] font-black uppercase tracking-[0.25em] mt-1 opacity-30 leading-none group-hover:opacity-60 transition-opacity truncate"
        >
          {{ isAllDone ? 'Processing Complete' : 'Toggle Selection' }}
        </span>
      </div>
    </div>

    <!-- 卡片切换按钮 -->
    <button
      @click="layoutStore.toggleCardSize"
      class="flex items-center justify-center hover:bg-muted rounded-xl transition-all active:scale-95 border border-transparent hover:border-border text-muted-foreground hover:text-primary group/size relative"
      :class="isPC ? 'w-11 h-11' : 'w-10 h-10'"
      :title="layoutStore.cardSizeMode === 'compact' ? '切换到大图模式' : '切换到紧凑模式'"
    >
      <LayoutGrid
        v-if="layoutStore.cardSizeMode === 'large'"
        :size="isPC ? 20 : 18"
        class="transition-transform group-hover/size:scale-110"
      />
      <Maximize2
        v-else
        :size="isPC ? 20 : 18"
        class="transition-transform group-hover/size:scale-110"
      />

      <!-- 提示气泡 (仅在 PC 悬停时展示) -->
      <div
        class="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-popover text-popover-foreground text-[10px] font-bold rounded border border-border opacity-0 group-hover/size:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl hidden md:block"
      >
        {{ layoutStore.cardSizeMode === 'compact' ? 'Large Cards' : 'Compact Cards' }}
      </div>
    </button>
  </div>
</template>

<style scoped>
.shadow-primary {
  box-shadow:
    0 10px 15px -3px hsla(var(--primary) / 0.15),
    0 4px 6px -2px hsla(var(--primary) / 0.1);
}
</style>
