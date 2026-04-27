<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'
import {
  LayoutGrid,
  LayoutList,
  Square,
  CheckSquare,
  MinusSquare
} from 'lucide-vue-next'
import { useBreakpoints } from '../../composables/useBreakpoints'

defineProps<{
  showCardSize?: boolean
}>()

const store = useImageStore()
const layoutStore = useLayoutStore()
const { t } = useI18n()

const allDone = computed(() => store.doneCount === store.selectedCount && store.selectedCount > 0)

const selectionIcon = computed(() => {
  if (store.isAllSelected) return CheckSquare
  if (store.selectedCount > 0) return MinusSquare
  return Square
})

const selectionLabel = computed(() => {
  if (store.isAllSelected) return t('common.image.selection.deselectAll')
  return t('common.image.selection.selectAll')
})
</script>

<template>
  <div class="flex items-center gap-2 md:gap-4 overflow-hidden">
    <!-- 交互式全选/取消全选按钮 -->
    <button
      @click="store.toggleAll()"
      class="flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted/30 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all duration-300 group active:scale-95 border border-border/20 hover:border-primary/20"
      :title="selectionLabel"
      :aria-label="selectionLabel"
    >
      <div class="relative flex items-center justify-center">
        <component
          :is="selectionIcon"
          :size="14"
          class="transition-transform duration-300 group-hover:scale-110"
          :class="{ 'text-primary': store.selectedCount > 0 }"
        />
        <!-- 成功状态小圆点 -->
        <div
          v-if="allDone"
          class="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 border-2 border-background animate-pulse"
        ></div>
      </div>

      <div class="flex items-center gap-1.5 pr-0.5 overflow-hidden">
        <span class="text-[10px] font-black tracking-tight tabular-nums whitespace-nowrap">
          <Transition name="slide-up" mode="out-in">
            <span
              :key="store.selectedCount"
              class="text-foreground/90 group-hover:text-primary transition-colors inline-block"
              >{{ store.selectedCount }}</span
            >
          </Transition>
          <span class="text-muted-foreground/30 mx-0.5">/</span>
          <span class="text-muted-foreground/40">{{ store.images.length }}</span>
        </span>
      </div>
...
<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
    </button>

    <!-- 卡片大小切换 -->
    <div
      v-if="showCardSize"
      class="hidden lg:flex items-center bg-muted/20 p-1 rounded-xl border border-border/40"
    >
      <button
        @click="layoutStore.cardSizeMode = 'large'"
        class="p-1.5 rounded-lg transition-all"
        :class="
          layoutStore.cardSizeMode === 'large'
            ? 'bg-background text-primary shadow-sm'
            : 'text-muted-foreground/40 hover:text-muted-foreground'
        "
        :title="t('common.toolbar.layoutLarge')"
      >
        <LayoutGrid :size="14" />
      </button>
      <button
        @click="layoutStore.cardSizeMode = 'compact'"
        class="p-1.5 rounded-lg transition-all"
        :class="
          layoutStore.cardSizeMode === 'compact'
            ? 'bg-background text-primary shadow-sm'
            : 'text-muted-foreground/40 hover:text-muted-foreground'
        "
        :title="t('common.toolbar.layoutCompact')"
      >
        <LayoutList :size="14" />
      </button>
    </div>
  </div>
</template>
