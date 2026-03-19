<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore, type ImageItem } from '../../stores/imageStore'
import {
  Trash2,
  SortAsc,
  Clock,
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  MoreVertical
} from 'lucide-vue-next'
import { useBreakpoints } from '../../composables/useBreakpoints'

const store = useImageStore()
const { isPC } = useBreakpoints()

const scrollContainer = ref<HTMLDivElement | null>(null)

const scroll = (direction: 'left' | 'right') => {
  if (!scrollContainer.value) return
  const amount = direction === 'left' ? -300 : 300
  scrollContainer.value.scrollBy({ left: amount, behavior: 'smooth' })
}

const handleSortChange = () => {
  const modes = ['upload', 'name', 'status'] as const
  const currentIndex = modes.indexOf(store.sortMode as any)
  const nextMode = modes[(currentIndex + 1) % modes.length]
  if (nextMode) store.sortMode = nextMode
}

const sortLabel = computed(() => {
  if (store.sortMode === 'upload') return '上传时间'
  if (store.sortMode === 'name') return '文件名称'
  return '处理状态'
})

const handleCardClick = (id: string) => {
  store.activeId = id
}

const getStatusIcon = (status: ImageItem['status']) => {
  if (status === 'processing') return Loader2
  if (status === 'done') return CheckCircle2
  if (status === 'error') return AlertCircle
  return null
}
</script>

<template>
  <div
    class="assets-tray bg-card/40 backdrop-blur-xl border-t border-border shrink-0 z-40 h-24 md:h-28 flex flex-col overflow-hidden"
  >
    <!-- 工具栏 -->
    <div
      class="flex items-center justify-between px-4 py-1.5 border-b border-border/40 bg-muted/20"
    >
      <div class="flex items-center gap-4">
        <button
          @click="handleSortChange"
          class="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest"
        >
          <Clock v-if="store.sortMode === 'upload'" :size="12" />
          <SortAsc v-else-if="store.sortMode === 'name'" :size="12" />
          <Zap v-else :size="12" />
          <span>排序: {{ sortLabel }}</span>
        </button>
        <div class="h-3 w-px bg-border/60 hidden md:block"></div>
        <div
          class="text-[10px] font-bold text-muted-foreground/40 hidden md:block uppercase tracking-tight"
        >
          {{ store.images.length }} 张图片 • {{ store.selectedCount }} 已选
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="store.clearImages"
          class="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all group"
        >
          <Trash2 :size="12" class="group-hover:scale-110 transition-transform" />
          <span class="text-[10px] font-bold uppercase tracking-wider">清空队列</span>
        </button>
      </div>
    </div>

    <!-- 队列容器 -->
    <div class="flex-1 flex items-center relative group/tray overflow-hidden">
      <!-- 左右导航 (仅PC悬浮) -->
      <button
        v-if="isPC"
        @click="scroll('left')"
        class="absolute left-0 inset-y-0 w-8 bg-gradient-to-r from-card to-transparent z-10 opacity-0 group-hover/tray:opacity-100 transition-opacity flex items-center justify-start pl-1 text-muted-foreground hover:text-primary"
      >
        <ChevronLeft :size="20" />
      </button>

      <div
        ref="scrollContainer"
        class="flex-1 h-full overflow-x-auto overflow-y-hidden custom-scrollbar-hidden flex items-center gap-2.5 px-4 scroll-smooth"
      >
        <div
          v-for="img in store.sortedImages"
          :key="img.id"
          class="relative shrink-0 group/item"
          @click="handleCardClick(img.id)"
        >
          <!-- 缩略图卡片 -->
          <div
            class="w-14 h-14 md:w-16 md:h-16 rounded-xl border-2 transition-all cursor-pointer overflow-hidden relative shadow-sm"
            :class="[
              store.activeId === img.id
                ? 'border-primary shadow-lg shadow-primary/10 ring-4 ring-primary/5 scale-105 z-10'
                : 'border-border/60 hover:border-border grayscale-[0.4] hover:grayscale-0'
            ]"
          >
            <img :src="img.preview" class="w-full h-full object-cover" />

            <!-- 选中状态勾选 -->
            <div
              @click.stop="store.toggleSelection(img.id)"
              class="absolute top-1 left-1 w-4 h-4 rounded-md border flex items-center justify-center transition-all bg-white/90 backdrop-blur-sm"
              :class="
                store.selectedIds.has(img.id)
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-black/10 opacity-0 group-hover/item:opacity-100'
              "
            >
              <CheckCircle2 v-if="store.selectedIds.has(img.id)" :size="10" />
            </div>

            <!-- 状态图标 -->
            <div
              v-if="img.status !== 'idle'"
              class="absolute bottom-1 right-1 p-0.5 rounded-full bg-background/80 backdrop-blur-sm shadow-sm"
            >
              <component
                :is="getStatusIcon(img.status)"
                :size="10"
                :class="{
                  'animate-spin text-primary': img.status === 'processing',
                  'text-green-500': img.status === 'done',
                  'text-destructive': img.status === 'error'
                }"
              />
            </div>

            <!-- 处理中遮罩 -->
            <div
              v-if="img.status === 'processing'"
              class="absolute inset-0 bg-primary/10 animate-pulse"
            ></div>
          </div>

          <!-- 快速删除按钮 (悬浮显示) -->
          <button
            @click.stop="store.removeImage(img.id)"
            class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-all scale-75 group-hover/item:scale-100 hover:bg-destructive/90 z-20"
          >
            <X :size="10" stroke-width="3" />
          </button>

          <!-- 活动指示器 -->
          <div
            class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full transition-all duration-300"
            :class="store.activeId === img.id ? 'opacity-100 scale-100' : 'opacity-0 scale-0'"
          ></div>
        </div>
      </div>

      <button
        v-if="isPC"
        @click="scroll('right')"
        class="absolute right-0 inset-y-0 w-8 bg-gradient-to-l from-card to-transparent z-10 opacity-0 group-hover/tray:opacity-100 transition-opacity flex items-center justify-end pr-1 text-muted-foreground hover:text-primary"
      >
        <ChevronRight :size="20" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar-hidden {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.custom-scrollbar-hidden::-webkit-scrollbar {
  display: none;
}

.assets-tray {
  box-shadow: 0 -4px 20px -2px rgba(0, 0, 0, 0.05);
}
</style>
