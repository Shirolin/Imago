<script setup lang="ts">
import { useImageStore } from '../../stores/imageStore'
import ImageUpload from '../common/ImageUpload.vue'

const store = useImageStore()

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
    <div v-else class="flex-1 flex flex-col md:flex-row overflow-hidden h-full">
      <div class="flex-1 flex flex-col min-w-0 min-h-[40vh] md:min-h-0 relative">
        <header
          class="h-14 md:h-[72px] bg-card border-b border-border shrink-0 relative z-10 overflow-x-auto overflow-y-hidden no-scrollbar"
        >
          <div class="h-full flex items-center min-w-max">
            <!-- 左侧边距占位 -->
            <div class="w-4 md:w-6 shrink-0"></div>

            <div class="flex items-center gap-3 md:gap-6">
              <slot name="header-left"></slot>
            </div>

            <!-- 中间间距占位 -->
            <div class="w-4 md:w-6 shrink-0"></div>

            <div class="flex items-center gap-2 md:gap-3 shrink-0 ml-auto">
              <slot name="header-actions"></slot>
            </div>

            <!-- 右侧边距占位 (关键修复: 确保滚动末端不截断) -->
            <div class="w-4 md:w-6 shrink-0"></div>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto p-4 md:p-6 bg-background custom-scrollbar">
          <div
            class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 md:gap-6"
          >
            <slot name="content"></slot>
          </div>
        </div>
      </div>

      <!-- 右侧控制面板 (可选) -->
      <aside
        v-if="showSidebar"
        class="w-full md:w-[280px] xl:w-[320px] max-h-[50vh] md:max-h-none bg-card border-t md:border-t-0 md:border-l border-border flex flex-col overflow-y-auto shrink-0 relative z-10"
      >
        <slot name="sidebar"></slot>
      </aside>
    </div>
  </div>
</template>
