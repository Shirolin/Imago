<script setup lang="ts">
import { useImageStore } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'
import ImageUpload from '../common/ImageUpload.vue'
import AssetsTray from './AssetsTray.vue'
import { PanelRightClose, PanelRightOpen, ChevronUp, ChevronDown } from 'lucide-vue-next'
import { useBreakpoints } from '../../composables/useBreakpoints'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { isCompact, isMedium, isUltra, isDesktop } = useBreakpoints()

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
      class="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative w-full max-w-full"
    >
      <!-- A. 左侧核心区域 (画布 + 资源托盘) -->
      <!-- 核心加固：在 Overlay 模式 (Compact/Medium) 展开时，为背景应用 inert 防止焦点穿透 -->
      <main
        class="flex-1 flex flex-col min-w-0 min-h-0 relative z-10 bg-background overflow-hidden transition-all duration-500 ease-apple"
        :inert="(isCompact || isMedium) && !layoutStore.isInspectorCollapsed ? true : undefined"
        :aria-hidden="(isCompact || isMedium) && !layoutStore.isInspectorCollapsed"
        :class="[
          isCompact && showSidebar && !layoutStore.isInspectorCollapsed ? 'pb-[70vh]' : '',
          isCompact && showSidebar && layoutStore.isInspectorCollapsed ? 'pb-11' : '',
          !isCompact ? 'pb-0' : ''
        ]"
      >
        <header
          class="h-14 bg-card border-b border-border/50 flex items-center px-4 md:px-6 justify-between gap-4 shrink-0 z-30"
        >
          <div class="flex items-center gap-4 md:gap-6 shrink min-w-0">
            <slot name="header-left"></slot>
          </div>
          <div class="flex items-center gap-2 md:gap-3 shrink-0">
            <slot name="header-actions"></slot>
            <button
              v-if="showSidebar"
              @click="layoutStore.toggleInspector"
              class="hidden lg:flex p-2 hover:bg-muted rounded-lg transition-all text-muted-foreground/60 hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] min-w-[44px] items-center justify-center"
              aria-label="Toggle Inspector Panel"
              :aria-expanded="!layoutStore.isInspectorCollapsed"
            >
              <PanelRightOpen v-if="layoutStore.isInspectorCollapsed" :size="18" />
              <PanelRightClose v-else :size="18" />
            </button>
            <!-- 平板/中屏模式下的切换按钮 -->
            <button
              v-if="showSidebar && isMedium"
              @click="layoutStore.toggleInspector"
              class="flex lg:hidden p-2 hover:bg-muted rounded-lg transition-all text-muted-foreground/60 hover:text-primary min-h-[44px] min-w-[44px] items-center justify-center"
              aria-label="Toggle Inspector Panel"
              :aria-expanded="!layoutStore.isInspectorCollapsed"
            >
              <PanelRightOpen v-if="layoutStore.isInspectorCollapsed" :size="18" />
              <PanelRightClose v-else :size="18" />
            </button>
          </div>
        </header>

        <!-- 内容画布 -->
        <div
          class="flex-1 relative min-h-0 w-full"
          :style="{
            overscrollBehavior: isCompact && !layoutStore.isInspectorCollapsed ? 'contain' : 'auto'
          }"
          :class="[
            noScroll
              ? 'overflow-hidden'
              : 'overflow-y-auto custom-scrollbar px-4 py-4 md:px-10 md:py-10',
            isUltra && !noScroll ? 'mx-auto max-w-[1600px]' : ''
          ]"
        >
          <div
            v-if="!noScroll"
            class="grid transition-all duration-300"
            :class="[
              layoutStore.cardSizeMode === 'compact'
                ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 lg:gap-8'
                : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 lg:gap-10'
            ]"
          >
            <slot name="content"></slot>
          </div>
          <slot v-else name="content"></slot>
        </div>

        <!-- 全局资源托盘 (智能感应与折叠) -->
        <div
          v-if="showAssetsTray && store.images.length > 1"
          class="shrink-0 w-0 min-w-full z-20 bg-card/30 transition-all duration-500 ease-apple overflow-hidden"
          :class="[
            (layoutStore.isAssetsTrayCollapsed && isDesktop) ||
            (isCompact && showSidebar && !layoutStore.isInspectorCollapsed)
              ? 'h-0 border-t-0'
              : 'h-32 md:h-28 border-t border-border/40'
          ]"
        >
          <div
            class="h-full w-full relative group/tray-outer"
            @dblclick="isDesktop && layoutStore.toggleAssetsTray"
          >
            <!-- 极简把手 -->
            <div
              v-if="isDesktop"
              class="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-muted-foreground/10 rounded-full mt-1 opacity-0 group-hover/tray-outer:opacity-100 transition-opacity cursor-ns-resize z-50 pointer-events-none"
            ></div>
            <AssetsTray />
          </div>
        </div>

        <!-- 3. 资产托盘折叠提示条 -->
        <div
          v-if="
            isDesktop &&
            showAssetsTray &&
            store.images.length > 1 &&
            layoutStore.isAssetsTrayCollapsed
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

      <!-- C. 右侧侧边栏 (Inspector) -->
      <aside
        v-if="showSidebar"
        id="inspector-panel"
        class="bg-card transition-all duration-500 ease-apple z-[200] lg:static shadow-2xl-up lg:shadow-none"
        role="complementary"
        :aria-label="isCompact ? '设置面板抽屉' : '设置侧边栏'"
        :class="[
          // XS: 底部抽屉
          isCompact
            ? 'fixed bottom-0 left-0 right-0 h-[70vh] rounded-t-[2.5rem] border-t border-border z-[300]'
            : '',
          isCompact && layoutStore.isInspectorCollapsed ? 'translate-y-[calc(100%-44px)]' : '',

          // MD: 悬浮面板 (专业平板质感)
          isMedium
            ? 'fixed top-4 right-4 bottom-4 w-[360px] rounded-[2rem] border border-border shadow-2xl z-[60]'
            : '',
          isMedium && layoutStore.isInspectorCollapsed
            ? 'translate-x-[calc(100%+2rem)]'
            : 'translate-x-0',

          // LG/XL: 常驻分栏
          isDesktop ? 'lg:border-l lg:h-auto lg:z-[60] lg:rounded-none' : '',
          isDesktop && layoutStore.isInspectorCollapsed
            ? 'lg:w-0 lg:overflow-hidden lg:border-l-0'
            : 'lg:w-[320px] 2xl:w-[360px]'
        ]"
      >
        <div
          class="h-full flex flex-col w-full overflow-hidden relative"
          :class="[isCompact ? 'rounded-t-[2.5rem]' : '', isMedium ? 'rounded-[2rem]' : '']"
        >
          <!-- 移动端把手 (仅 XS 可见，MD 隐藏) -->
          <div
            v-if="isCompact"
            @click="layoutStore.toggleInspector"
            class="flex flex-col items-center justify-center h-11 shrink-0 cursor-pointer touch-none group bg-card border-b border-border/10"
            role="button"
            :aria-label="layoutStore.isInspectorCollapsed ? '展开面板' : '折叠面板'"
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

          <!-- MD 专用标题栏 (提升专业感) -->
          <div
            v-if="isMedium"
            class="h-14 flex items-center justify-between px-6 border-b border-border/10 shrink-0"
          >
            <span class="text-xs font-black uppercase tracking-widest text-muted-foreground/60"
              >Inspector</span
            >
            <button
              @click="layoutStore.toggleInspector"
              class="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground/40 hover:text-primary"
              aria-label="关闭面板"
            >
              <PanelRightClose :size="18" />
            </button>
          </div>

          <!-- 核心内容滚动区 -->
          <div
            class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar w-full"
            :class="{ 'opacity-0': layoutStore.isInspectorCollapsed && isCompact }"
          >
            <div class="p-4 md:p-6 flex flex-col gap-8 pb-6">
              <slot name="sidebar"></slot>
            </div>
          </div>

          <!-- 工作流工具栏 -->
          <div
            v-if="(!layoutStore.isInspectorCollapsed || isDesktop) && $slots.toolbar"
            class="shrink-0 px-4 md:px-5 py-2 border-t border-border/20 bg-card"
          >
            <slot name="toolbar"></slot>
          </div>

          <!-- 核心操作按钮区 -->
          <div v-if="!layoutStore.isInspectorCollapsed || isDesktop" class="shrink-0 z-30">
            <slot name="footer"></slot>
          </div>
        </div>
      </aside>

      <!-- 平板模式下的遮罩层 (当侧边栏展开时) -->
      <div
        v-if="isMedium && showSidebar && !layoutStore.isInspectorCollapsed"
        @click="layoutStore.toggleInspector"
        class="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50 transition-opacity duration-500"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.shadow-2xl-up {
  box-shadow: 0 -10px 40px -15px hsl(var(--foreground) / 0.1);
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
