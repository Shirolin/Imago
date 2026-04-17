<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'
import {
  ChevronRight,
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
const { isPC } = useBreakpoints()
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
      class="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-muted/30 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-300 group active:scale-95 border border-border/40 hover:border-primary/20"
      :title="selectionLabel"
      :aria-label="selectionLabel"
    >
      <div class="relative flex items-center justify-center">
        <component
          :is="selectionIcon"
          :size="18"
          class="transition-transform duration-300 group-hover:scale-110"
          :class="{ 'text-primary': store.selectedCount > 0 }"
        />
        <!-- 成功状态小圆点 -->
        <div
          v-if="allDone"
          class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 border-2 border-background animate-pulse"
        ></div>
      </div>

      <div class="flex items-center gap-1.5 pr-1">
        <span class="text-[11px] font-black tracking-tight tabular-nums whitespace-nowrap">
          <span class="text-foreground/90 group-hover:text-primary transition-colors">{{
            store.selectedCount
          }}</span>
          <span class="text-muted-foreground/30 mx-1">/</span>
          <span class="text-muted-foreground/40">{{ store.images.length }}</span>
        </span>

        <!-- PC端额外提示 (极简版) -->
        <div v-if="isPC" class="flex items-center gap-1 border-l border-border/40 pl-2 ml-1">
          <span
            class="text-[9px] font-bold uppercase tracking-[0.1em] opacity-40 group-hover:opacity-100 transition-opacity whitespace-nowrap"
          >
            {{ selectionLabel }}
          </span>
          <ChevronRight
            :size="10"
            class="opacity-20 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
          />
        </div>
      </div>
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
