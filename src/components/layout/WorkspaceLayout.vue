<script setup lang="ts">
import { useImageStore } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'
import ImageUpload from '../common/ImageUpload.vue'
import { PanelRightClose, PanelRightOpen } from 'lucide-vue-next'

const store = useImageStore()
const layoutStore = useLayoutStore()

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
  <div class="h-full flex flex-col">
    <!-- 空状态 -->
    <div v-if="store.images.length === 0" class="flex-1 flex items-center justify-center p-8">
      <ImageUpload @upload="store.addImages" />
    </div>

    <!-- 工作区 -->
    <div v-else class="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0">
      <div class="flex-1 flex flex-col min-w-0 min-h-0 relative">
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
          class="flex-1 bg-background/50 custom-scrollbar overscroll-contain relative"
          :class="[
            noScroll
              ? 'overflow-hidden flex flex-col min-h-0'
              : 'overflow-y-auto px-6 py-6 md:px-10 md:py-10'
          ]"
        >
          <div
            v-if="!noScroll"
            class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6 md:gap-10"
          >
            <slot name="content"></slot>
          </div>
          <slot v-else name="content"></slot>

          <!-- 移动端 FAB: 拇指优先控制侧边栏 (Adaptation) -->
          <button
            v-if="showSidebar && layoutStore.isInspectorCollapsed"
            @click="layoutStore.toggleInspector"
            class="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 transition-transform animate-in fade-in zoom-in duration-300"
            aria-label="打开参数配置"
          >
            <PanelRightOpen :size="24" />
          </button>
        </div>
      </div>

      <!-- 移动端背景遮罩 -->
      <Transition name="fade">
        <div
          v-if="showSidebar && !layoutStore.isInspectorCollapsed"
          @click="layoutStore.toggleInspector"
          class="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 md:hidden"
        ></div>
      </Transition>

      <!-- 右侧控制面板 (Inspector) - 支持移动端抽屉 -->
      <aside
        v-if="showSidebar"
        id="inspector-panel"
        class="bg-card border-t md:border-t-0 md:border-l border-border flex flex-col shrink-0 relative transition-all duration-300 ease-in-out z-50 md:z-20"
        :class="[
          // 移动端样式：固定在底部的抽屉 (Bottom Sheet)
          'fixed bottom-0 left-0 right-0 md:static w-full md:h-auto rounded-t-[2.5rem] md:rounded-none',
          layoutStore.isInspectorCollapsed
            ? 'translate-y-full md:translate-y-0 md:w-0 border-transparent invisible md:visible'
            : 'translate-y-0 md:w-[300px] xl:w-[340px] shadow-2xl-up visible',
          // 高度控制
          'max-h-[85vh] md:max-h-none'
        ]"
      >
        <div class="min-w-full md:min-w-[300px] xl:min-w-[340px] h-full flex flex-col">
          <!-- 移动端抽屉把手 (扩大点击热区符合 44x44px) -->
          <div
            @click="layoutStore.toggleInspector"
            class="md:hidden flex flex-col items-center justify-center pt-3 pb-5 shrink-0 cursor-pointer active:opacity-50"
          >
            <div class="w-12 h-1.5 bg-muted rounded-full"></div>
            <span
              class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mt-2"
              >滑动或点击关闭</span
            >
          </div>
          <slot name="sidebar"></slot>
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
