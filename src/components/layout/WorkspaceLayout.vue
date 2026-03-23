<script setup lang="ts">
import { useImageStore } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'
import ImageUpload from '../common/ImageUpload.vue'
import AssetsTray from './AssetsTray.vue'
import { PanelRightClose, PanelRightOpen, ChevronUp, ChevronDown } from 'lucide-vue-next'
import { useBreakpoints } from '../../composables/useBreakpoints'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { isPC, isMobile } = useBreakpoints()

interface Props {
  showSidebar?: boolean
  noScroll?: boolean
  showAssetsTray?: boolean
}

defineProps<Props>()
</script>

<template>
  <div class="h-full flex flex-col relative bg-background overflow-hidden">
    <!-- 1. 空状态 -->
    <div v-if="store.images.length === 0" class="flex-1 flex items-center justify-center p-8">
      <ImageUpload @upload="store.addImages" />
    </div>

    <!-- 2. 主工作布局 -->
    <div
      v-else
      class="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden relative w-full max-w-full"
    >
      <!-- A. 左侧核心区域 (画布 + 资源托盘) -->
      <main
        class="flex-1 flex flex-col min-w-0 min-h-0 relative z-10 bg-background overflow-hidden"
        :class="{ 'pb-11 md:pb-0': isMobile && showSidebar }"
      >
        <header
          class="h-14 bg-card border-b border-border/50 flex items-center px-4 md:px-6 justify-between gap-4 shrink-0 z-30"
        >
          <div class="flex items-center gap-4 md:gap-6 shrink-0">
            <slot name="header-left"></slot>
          </div>
          <div class="flex items-center gap-2 md:gap-3 shrink min-w-0">
            <slot name="header-actions"></slot>
            <button
              v-if="showSidebar"
              @click="layoutStore.toggleInspector"
              class="hidden md:flex p-2 hover:bg-muted rounded-lg transition-all text-muted-foreground/60 hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] min-w-[44px] items-center justify-center"
              aria-label="Toggle Inspector Panel"
            >
              <PanelRightOpen v-if="layoutStore.isInspectorCollapsed" :size="18" />
              <PanelRightClose v-else :size="18" />
            </button>
          </div>
        </header>

        <!-- 内容画布 -->
        <div
          class="flex-1 relative min-h-0 w-full"
          :class="[
            noScroll
              ? 'overflow-hidden'
              : 'overflow-y-auto custom-scrollbar px-6 py-6 md:px-10 md:py-10'
          ]"
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

        <!-- 全局资源托盘 (智能感应与折叠) -->
        <div
          v-if="showAssetsTray && store.images.length > 1"
          class="shrink-0 w-0 min-w-full border-t border-border/40 z-20 bg-card/30 transition-all duration-500 ease-apple overflow-hidden"
          :class="[
            layoutStore.isAssetsTrayCollapsed && isPC
              ? 'h-0 border-t-0'
              : showSidebar && isMobile && layoutStore.isInspectorCollapsed
                ? 'h-[148px]'
                : 'h-24 md:h-28'
          ]"
        >
          <div
            class="h-full w-full relative group/tray-outer"
            @dblclick="layoutStore.toggleAssetsTray"
          >
            <!-- 极简把手 (仅在 PC 悬停或折叠时可见，提示可折叠) -->
            <div
              class="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-muted-foreground/10 rounded-full mt-1 opacity-0 group-hover/tray-outer:opacity-100 transition-opacity cursor-ns-resize z-50 pointer-events-none"
            ></div>
            <AssetsTray />
          </div>
        </div>

        <!-- 3. 资产托盘折叠提示条 (仅限 PC 端且已折叠时) -->
        <div
          v-if="
            isPC && showAssetsTray && store.images.length > 1 && layoutStore.isAssetsTrayCollapsed
          "
          @click="layoutStore.toggleAssetsTray"
          class="h-8 bg-muted/10 hover:bg-primary/[0.03] backdrop-blur-md cursor-pointer transition-all border-t border-border/10 shrink-0 group flex items-center justify-between px-6"
          title="展开资源托盘 (Tab)"
        >
          <div class="flex-1"></div>
          <div class="flex items-center gap-2">
            <ChevronUp
              :size="14"
              class="text-primary/40 group-hover:text-primary transition-all group-hover:-translate-y-0.5"
            />
            <span
              class="text-[0.65rem] font-bold text-muted-foreground/40 group-hover:text-primary/60 uppercase tracking-[0.2em] transition-colors"
              >Show Assets</span
            >
          </div>
          <div class="flex-1 flex justify-end">
            <div
              class="px-2 py-0.5 rounded-full bg-primary/5 border border-primary/10 text-[0.6rem] font-mono font-bold text-primary/40 group-hover:text-primary/60 transition-colors"
            >
              {{ store.images.length }}
            </div>
          </div>
        </div>
      </main>

      <!-- 移动端背景遮罩 -->
      <Transition name="fade">
        <div
          v-if="showSidebar && !layoutStore.isInspectorCollapsed"
          @click="layoutStore.toggleInspector"
          class="fixed inset-0 bg-background/60 backdrop-blur-sm z-[150] md:hidden"
        ></div>
      </Transition>

      <!-- C. 右侧侧边栏 (Inspector) -->
      <!-- 物理锁定：侧边栏必须是一个独立的垂直 Flex 容器，InspectorFooter 放在其底部 -->
      <aside
        v-if="showSidebar"
        id="inspector-panel"
        class="bg-card md:border-l border-border flex flex-col shrink-0 transition-all duration-500 ease-apple z-[200] md:z-[60] fixed bottom-0 left-0 right-0 md:static w-full md:h-auto rounded-t-[2.5rem] md:rounded-none shadow-2xl-up md:shadow-none overflow-visible"
        :class="[
          layoutStore.isInspectorCollapsed
            ? 'translate-y-[calc(100%-44px)] md:w-0'
            : 'translate-y-0 md:w-[320px] xl:w-[360px] top-16 md:top-auto'
        ]"
      >
        <div
          class="h-full flex flex-col w-full md:w-[320px] xl:w-[360px] overflow-hidden rounded-t-[2.5rem] md:rounded-none bg-card relative"
        >
          <!-- 移动端把手 -->
          <div
            @click="layoutStore.toggleInspector"
            class="md:hidden flex flex-col items-center justify-center h-11 shrink-0 cursor-pointer touch-none group bg-card border-b border-border/10"
          >
            <div
              class="w-12 h-1.5 bg-muted-foreground/20 rounded-full transition-all group-hover:bg-muted-foreground/40"
            ></div>
            <div class="mt-1 flex items-center justify-center h-4">
              <ChevronUp
                v-if="layoutStore.isInspectorCollapsed"
                :size="14"
                class="text-primary/40 animate-bounce-subtle"
              />
              <ChevronDown v-else :size="14" class="text-muted-foreground/20" />
            </div>
          </div>

          <!-- 核心内容滚动区 (flex-1 确保其占据剩余空间并独立滚动) -->
          <div
            class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar w-full"
            :class="{ 'opacity-0': layoutStore.isInspectorCollapsed && !isPC }"
          >
            <div class="p-4 md:p-5 flex flex-col gap-8 pb-6">
              <slot name="sidebar"></slot>
            </div>
          </div>

          <!-- 工作流工具栏 (如 Undo/Redo，独立于滚动，紧贴按钮区) -->
          <div
            v-if="(!layoutStore.isInspectorCollapsed || isPC) && $slots.toolbar"
            class="shrink-0 px-4 md:px-5 py-2 border-t border-border/20 bg-card"
          >
            <slot name="toolbar"></slot>
          </div>

          <!-- 核心操作按钮区 (物理隔离，永不随内容滚动) -->
          <div v-if="!layoutStore.isInspectorCollapsed || isPC" class="shrink-0 z-30">
            <slot name="footer"></slot>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.shadow-2xl-up {
  box-shadow: 0 -10px 40px -15px rgba(0, 0, 0, 0.12);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.ease-apple {
  transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
}
@keyframes bounce-subtle {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}
.animate-bounce-subtle {
  animation: bounce-subtle 2s infinite ease-in-out;
}
</style>
