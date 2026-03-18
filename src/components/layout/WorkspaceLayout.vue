<script setup lang="ts">
import { useImageStore } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'
import ImageUpload from '../common/ImageUpload.vue'
import { PanelRightClose, PanelRightOpen, ChevronUp, ChevronDown } from 'lucide-vue-next'
import { useBreakpoints } from '../../composables/useBreakpoints'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { isPC } = useBreakpoints()

interface Props {
  showSidebar?: boolean
  noScroll?: boolean
}

withDefaults(defineProps<Props>(), {
  showSidebar: false,
  noScroll: false
})
</script>

<template>
  <div class="h-full flex flex-col relative">
    <!-- 空状态 -->
    <div v-if="store.images.length === 0" class="flex-1 flex items-center justify-center p-8">
      <ImageUpload @upload="store.addImages" />
    </div>

    <!-- 工作区 -->
    <div
      v-else
      class="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0 h-full w-full"
    >
      <!-- 使用 absolute inset-0 彻底解决高度塌陷问题 -->
      <div
        id="debug-workspace-inner"
        class="absolute inset-0 md:relative md:inset-auto flex-1 flex flex-col min-w-0 min-h-0 h-full w-full z-0"
      >
        <header
          class="bg-card/80 backdrop-blur-md border-b border-border shrink-0 relative z-30 overflow-x-auto overflow-y-hidden h-14 custom-scrollbar"
        >
          <div class="h-full flex items-center px-4 md:px-6 w-full justify-between gap-4">
            <div class="flex items-center gap-4 md:gap-6 shrink-0">
              <slot name="header-left"></slot>
            </div>

            <div class="flex items-center gap-2 md:gap-3 shrink min-w-0">
              <slot name="header-actions"></slot>

              <!-- 独立控制右侧面板的开关 (仅在桌面端显示，移动端改用 FAB) -->
              <button
                v-if="showSidebar"
                @click="layoutStore.toggleInspector"
                class="hidden md:flex p-2 hover:bg-muted rounded-lg transition-all duration-200 text-muted-foreground/60 hover:text-primary ml-1 shrink-0 active:scale-95 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                :class="{ 'bg-muted text-primary opacity-100': !layoutStore.isInspectorCollapsed }"
                :aria-expanded="!layoutStore.isInspectorCollapsed"
                aria-controls="inspector-panel"
                :title="layoutStore.isInspectorCollapsed ? '展开属性面板' : '收起属性面板'"
              >
                <PanelRightOpen v-if="layoutStore.isInspectorCollapsed" :size="18" />
                <PanelRightClose v-else :size="18" />
              </button>
            </div>
          </div>
        </header>

        <div
          class="flex-1 bg-background/50 custom-scrollbar overscroll-contain relative min-h-0 h-full"
          :class="[
            noScroll
              ? 'overflow-hidden flex flex-col md:overflow-hidden'
              : 'overflow-y-auto px-6 py-6 md:px-10 md:py-10'
          ]"
          style="overflow: visible"
        >
          <div
            v-if="!noScroll"
            class="grid transition-all duration-300"
            :class="[
              layoutStore.cardSizeMode === 'compact'
                ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 md:gap-8'
                : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 md:gap-10'
            ]"
          >
            <slot name="content"></slot>
          </div>
          <slot v-else name="content"></slot>
        </div>
      </div>

      <!-- 移动端背景遮罩 -->
      <Transition name="fade">
        <div
          v-if="showSidebar && !layoutStore.isInspectorCollapsed"
          @click="layoutStore.toggleInspector"
          class="fixed inset-0 bg-background/60 backdrop-blur-sm z-[150] md:hidden"
        ></div>
      </Transition>

      <!-- 右侧控制面板 (Inspector) - 桌面端占位符/移动端独立抽屉 -->
      <aside
        v-if="showSidebar"
        id="inspector-panel"
        class="bg-card border-t md:border-t-0 md:border-l border-border flex flex-col shrink-0 transition-all duration-500 ease-apple z-[200] md:z-[60]"
        style="overflow: visible"
        :class="[
          // 移动端样式：固定在底部的抽屉 (Bottom Sheet)
          'fixed bottom-0 top-auto left-0 right-0 md:static w-full md:h-auto rounded-t-[2rem] md:rounded-none',
          layoutStore.isInspectorCollapsed
            ? 'translate-y-[calc(100%-44px)] md:translate-y-0 md:w-0 border-transparent shadow-[0_-4px_15px_-1px_rgba(0,0,0,0.06)] md:shadow-none'
            : 'translate-y-0 md:w-[300px] xl:w-[340px] shadow-[0_-15px_40px_-10px_rgba(0,0,0,0.2)] md:shadow-none visible',
          // 高度控制：大幅提升上限，仅保留顶部 20px 呼吸感
          'max-h-[calc(100dvh-20px)] md:max-h-none'
        ]"
      >
        <div
          class="min-w-full md:min-w-[300px] xl:min-w-[340px] h-full flex flex-col rounded-t-[2rem] md:rounded-none overflow-hidden"
        >
          <!-- 移动端抽屉把手 (增加动态指示器) -->
          <div
            @click="layoutStore.toggleInspector"
            class="md:hidden flex flex-col items-center justify-center h-10 shrink-0 cursor-pointer active:opacity-50 touch-none group/handle"
          >
            <div
              class="w-10 h-1 bg-muted-foreground/20 rounded-full transition-all group-hover/handle:bg-muted-foreground/40"
            ></div>
            <div class="mt-1.5 flex flex-col items-center justify-center h-3">
              <ChevronUp
                v-if="layoutStore.isInspectorCollapsed"
                :size="14"
                class="text-primary/40 animate-bounce-subtle"
              />
              <ChevronDown
                v-else
                :size="14"
                class="text-muted-foreground/20 animate-bounce-subtle"
              />
            </div>
          </div>
          <div
            class="flex-1 min-h-0 overflow-y-auto custom-scrollbar"
            :class="{ 'opacity-0 pointer-events-none': layoutStore.isInspectorCollapsed && !isPC }"
          >
            <slot name="sidebar"></slot>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 767px) {
  .shadow-2xl-up {
    box-shadow: 0 -10px 40px -15px rgba(0, 0, 0, 0.3);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
