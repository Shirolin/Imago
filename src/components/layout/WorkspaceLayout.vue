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
    <div v-else class="flex-1 flex overflow-hidden h-full">
      <div class="flex-1 flex flex-col min-w-0 relative">
        <header
          class="h-14 md:h-[72px] px-4 md:px-6 bg-card border-b border-border flex items-center justify-between gap-3 md:gap-6 shrink-0 relative z-10 overflow-x-auto no-scrollbar"
        >
          <div class="flex items-center gap-3 md:gap-6 min-w-max">
            <slot name="header-left"></slot>
          </div>
          <div class="flex items-center gap-2 md:gap-3 shrink-0">
            <slot name="header-actions"></slot>
          </div>
        </header>

        <div
          class="flex-1 overflow-y-auto p-4 md:p-6 bg-background custom-scrollbar"
        >
          <div class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 md:gap-6">
            <slot name="content"></slot>
          </div>
        </div>
      </div>

      <!-- 右侧控制面板 (可选) -->
      <aside
        v-if="showSidebar"
        class="w-[280px] xl:w-[320px] bg-card border-l border-border flex flex-col overflow-y-auto shrink-0 relative z-10"
      >
        <slot name="sidebar"></slot>
      </aside>
    </div>
  </div>
</template>
