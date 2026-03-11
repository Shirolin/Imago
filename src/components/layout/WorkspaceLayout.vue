<script setup lang="ts">
import { useImageStore } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'
import ImageUpload from '../common/ImageUpload.vue'
import { PanelRightClose, PanelRightOpen } from 'lucide-vue-next'

const store = useImageStore()
const layoutStore = useLayoutStore()

interface Props {
  showSidebar?: boolean
}

withDefaults(defineProps<Props>(), {
  showSidebar: false
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 空状态 -->
    <div v-if="store.images.length === 0" class="flex-1 flex items-center justify-center p-8">
      <ImageUpload @upload="store.addImages" />
    </div>

    <!-- 工作区 -->
    <div v-else class="flex-1 flex flex-col md:flex-row overflow-hidden h-full relative">
      <div class="flex-1 flex flex-col min-w-0 min-h-[40vh] md:min-h-0 relative">
        <header
          class="bg-card/80 backdrop-blur-md border-b border-border shrink-0 relative z-20 overflow-x-auto overflow-y-hidden no-scrollbar h-14"
        >
          <div class="h-full flex items-center px-4 md:px-6 min-w-max">
            <div class="flex items-center gap-4 md:gap-6 shrink-0">
              <slot name="header-left"></slot>
            </div>

            <div class="flex items-center gap-2 md:gap-3 shrink-0 ml-auto">
              <slot name="header-actions"></slot>

              <!-- 独立控制右侧面板的开关 -->
              <button
                v-if="showSidebar"
                @click="layoutStore.toggleInspector"
                class="hidden md:flex p-2 hover:bg-muted rounded-lg transition-all duration-200 text-muted-foreground ml-1 active:scale-95"
                :class="{ 'bg-muted text-primary': !layoutStore.isInspectorCollapsed }"
                :title="layoutStore.isInspectorCollapsed ? '展开属性面板' : '收起属性面板'"
              >
                <PanelRightOpen v-if="layoutStore.isInspectorCollapsed" :size="18" />
                <PanelRightClose v-else :size="18" />
              </button>
            </div>
          </div>
        </header>

        <div
          class="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-10 bg-background/50 custom-scrollbar overscroll-contain"
        >
          <div
            class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6 md:gap-10"
          >
            <slot name="content"></slot>
          </div>
        </div>
      </div>

      <!-- 右侧控制面板 (Inspector) - 独立控制 -->
      <aside
        v-if="showSidebar"
        class="bg-card border-t md:border-t-0 md:border-l border-border flex flex-col shrink-0 relative z-10 transition-all duration-300 ease-in-out overflow-hidden shadow-2xl md:shadow-none"
        :class="[
          'w-full max-h-[50vh] md:max-h-none',
          layoutStore.isInspectorCollapsed
            ? 'md:w-0 border-transparent'
            : 'md:w-[300px] xl:w-[340px]'
        ]"
      >
        <div class="min-w-[300px] xl:min-w-[340px] h-full flex flex-col">
          <slot name="sidebar"></slot>
        </div>
      </aside>
    </div>
  </div>
</template>
