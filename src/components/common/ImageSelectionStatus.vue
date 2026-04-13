<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'
import { CheckCircle2, ChevronRight, LayoutGrid, LayoutList } from 'lucide-vue-next'
import { useBreakpoints } from '../../composables/useBreakpoints'

defineProps<{
  showCardSize?: boolean
}>()

const store = useImageStore()
const layoutStore = useLayoutStore()
const { isPC } = useBreakpoints()
const { t } = useI18n()

const allDone = computed(() => store.doneCount === store.selectedCount && store.selectedCount > 0)
</script>

<template>
  <div class="flex items-center gap-3 md:gap-5 overflow-hidden">
    <!-- 状态指示器 (核心视觉焦点) -->
    <div class="flex items-center gap-2.5 group relative">
      <div
        class="w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center transition-all duration-500 relative"
        :class="[
          allDone
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 rotate-0'
            : 'bg-primary/10 text-primary rotate-[-4deg] group-hover:rotate-0'
        ]"
      >
        <!-- 成功状态的扩散背景 (Success Ripple) -->
        <div
          v-if="allDone"
          class="absolute inset-0 rounded-2xl bg-emerald-500 animate-ping opacity-20"
        ></div>

        <!-- 图标区 -->
        <div class="relative z-10">
          <CheckCircle2
            v-if="allDone"
            :size="isPC ? 22 : 20"
            class="animate-in zoom-in duration-300"
          />
          <div v-else class="relative">
            <span class="text-sm md:text-base font-black tabular-nums">{{
              store.selectedCount
            }}</span>
            <div
              class="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
            ></div>
          </div>
        </div>
      </div>

      <!-- 文字区 -->
      <div class="flex flex-col min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="text-xs md:text-sm font-black text-foreground tracking-tight whitespace-nowrap"
          >
            <span v-if="isPC">{{ t('common.image.selection.selected') }} </span>
            <span class="tabular-nums text-primary">{{ store.selectedCount }}</span>
            <span class="text-muted-foreground/40 mx-1">/</span>
            <span class="tabular-nums opacity-40">{{ store.images.length }}</span>
          </span>

          <!-- Ready 状态标签 (仅在 PC 或全选完成时展示) -->
          <div
            v-if="allDone"
            class="hidden sm:flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-md text-[9px] font-black uppercase tracking-wider border border-emerald-500/20 animate-in fade-in slide-in-from-left-2"
          >
            {{ t('common.image.selection.complete') }}
          </div>
        </div>

        <!-- 副标题 (仅 PC 展示) -->
        <div v-if="isPC" class="flex items-center gap-1.5 mt-0.5">
          <div
            class="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] whitespace-nowrap"
          >
            {{
              allDone ? t('common.image.selection.allSelected') : t('common.image.selection.toggle')
            }}
          </div>
          <ChevronRight :size="10" class="text-muted-foreground/20" />
        </div>
      </div>
    </div>

    <div v-if="showCardSize" class="hidden lg:flex items-center gap-1 self-center ml-2">
      <button
        @click="layoutStore.cardSizeMode = 'large'"
        class="p-1.5 rounded-lg transition-all"
        :class="
          layoutStore.cardSizeMode === 'large'
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground/40 hover:text-muted-foreground'
        "
      >
        <LayoutGrid :size="16" />
      </button>
      <button
        @click="layoutStore.cardSizeMode = 'compact'"
        class="p-1.5 rounded-lg transition-all"
        :class="
          layoutStore.cardSizeMode === 'compact'
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground/40 hover:text-muted-foreground'
        "
      >
        <LayoutList :size="16" />
      </button>
    </div>
  </div>
</template>
