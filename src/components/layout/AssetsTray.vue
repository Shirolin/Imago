<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useImageStore, type ImageItem } from '../../stores/imageStore'
import {
  SortAsc,
  Clock,
  Timer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next'

const store = useImageStore()

const scrollContainer = ref<HTMLDivElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

const checkScroll = () => {
  if (!scrollContainer.value) return
  const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value
  canScrollLeft.value = scrollLeft > 10
  canScrollRight.value = scrollLeft + clientWidth < scrollWidth - 10
}

onMounted(() => {
  checkScroll()
  const resizeObserver = new ResizeObserver(checkScroll)
  if (scrollContainer.value) resizeObserver.observe(scrollContainer.value)
  onUnmounted(() => resizeObserver.disconnect())
})

watch(
  () => store.activeId,
  (id) => {
    if (!id || !scrollContainer.value) return
    nextTick(() => {
      const activeEl = scrollContainer.value?.querySelector(`[data-id="${id}"]`) as HTMLElement
      if (activeEl && scrollContainer.value) {
        const container = scrollContainer.value
        const scrollLeft =
          activeEl.offsetLeft - container.clientWidth / 2 + activeEl.offsetWidth / 2

        requestAnimationFrame(() => {
          container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
        })
      }
    })
  }
)

const scroll = (direction: 'left' | 'right') => {
  if (!scrollContainer.value) return
  const amount = direction === 'left' ? -containerWidth() * 0.6 : containerWidth() * 0.6
  scrollContainer.value.scrollBy({ left: amount, behavior: 'smooth' })
}

const containerWidth = () => scrollContainer.value?.clientWidth || 400

const handleWheel = (e: WheelEvent) => {
  if (!scrollContainer.value) return
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault()
    scrollContainer.value.scrollLeft += e.deltaY
  }
}

const handleSortChange = () => {
  const modes = ['upload', 'name', 'status'] as const
  const currentIndex = modes.indexOf(store.sortMode)
  const nextMode = modes[(currentIndex + 1) % modes.length]
  if (nextMode) store.sortMode = nextMode
}

// 保持排序标题
const sortTitle = computed(() => {
  if (store.sortMode === 'upload') return '当前排序: 导入时间 (点击切换)'
  if (store.sortMode === 'name') return '当前排序: 文件名称 (点击切换)'
  return '当前排序: 处理状态 (点击切换)'
})

const getStatusIcon = (status: ImageItem['status']) => {
  if (status === 'processing') return Loader2
  if (status === 'done') return CheckCircle2
  if (status === 'error') return AlertCircle
  return null
}

// --- 增强：键盘导航与快捷键 ---
const navigate = (direction: 'prev' | 'next') => {
  const list = store.sortedImages
  if (list.length <= 1) return

  const currentIndex = list.findIndex((img) => img.id === store.activeId)
  if (currentIndex === -1) return

  let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1
  if (nextIndex < 0) nextIndex = list.length - 1
  if (nextIndex >= list.length) nextIndex = 0

  const nextImg = list[nextIndex]
  if (nextImg) {
    store.activeId = nextImg.id
    // 物理焦点同步
    setTimeout(() => {
      const el = scrollContainer.value?.querySelector(
        `[data-id="${nextImg.id}"] .image-card-trigger`
      ) as HTMLElement
      el?.focus()
    }, 50)
  }
}

const handleGlobalKeyDown = (e: KeyboardEvent) => {
  const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
  if (isInput) return

  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    navigate('prev')
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    navigate('next')
  }
}

const handleCheckboxKeyDown = (e: KeyboardEvent, id: string) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    store.toggleSelection(id)
  }
}

const handleCardKeyDown = (e: KeyboardEvent, id: string) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    store.activeId = id
  }
}

const handleKeyDownInternal = (e: KeyboardEvent) => {
  handleGlobalKeyDown(e)
}

onMounted(() => window.addEventListener('keydown', handleKeyDownInternal))
onUnmounted(() => window.removeEventListener('keydown', handleKeyDownInternal))

// --- 增强：拖拽排序 ---
const draggedId = ref<string | null>(null)
const dropTargetId = ref<string | null>(null)

const onDragStart = (e: DragEvent, id: string) => {
  if (store.sortMode !== 'upload') return
  draggedId.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
}

const onDragOver = (e: DragEvent, id: string) => {
  if (draggedId.value && draggedId.value !== id) {
    e.preventDefault()
    dropTargetId.value = id
  }
}

const onDrop = (e: DragEvent, toId: string) => {
  e.preventDefault()
  if (draggedId.value && draggedId.value !== toId) {
    store.reorderImage(draggedId.value, toId)
  }
  draggedId.value = null
  dropTargetId.value = null
}

const onDragEnd = () => {
  draggedId.value = null
  dropTargetId.value = null
}
</script>

<template>
  <div
    class="assets-tray bg-card/80 backdrop-blur-3xl border-t border-border/40 shrink-0 z-40 h-full flex flex-col overflow-hidden select-none w-full min-w-0"
  >
    <!-- 头部工具栏 -->
    <div
      class="flex items-center justify-between px-3 h-7 border-b border-border/10 bg-muted/5 shrink-0"
    >
      <div class="flex items-center gap-2">
        <button
          @click="handleSortChange"
          @dblclick.stop
          :title="sortTitle"
          class="p-1.5 rounded-md text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Clock v-if="store.sortMode === 'upload'" :size="12" />
          <SortAsc v-else-if="store.sortMode === 'name'" :size="12" />
          <Timer v-else :size="12" />
        </button>

        <div class="h-2.5 w-px bg-border/20 mx-0.5"></div>

        <div class="flex items-center bg-background/40 p-0.5 rounded-lg border border-border/20">
          <button
            @click="navigate('prev')"
            @dblclick.stop
            class="p-1 hover:bg-background rounded-md transition-colors text-muted-foreground hover:text-primary active:scale-90"
            title="上一个 (←)"
          >
            <ChevronLeft :size="13" />
          </button>
          <div class="w-px h-2.5 bg-border/20 mx-0.5"></div>
          <button
            @click="navigate('next')"
            @dblclick.stop
            class="p-1 hover:bg-background rounded-md transition-colors text-muted-foreground hover:text-primary active:scale-90"
            title="下一个 (→)"
          >
            <ChevronRight :size="13" />
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2 mr-1">
        <span class="text-[0.7rem] font-black text-muted-foreground/50 uppercase tracking-widest"
          >Items</span
        >
        <span class="text-xs font-mono font-bold text-primary">{{ store.images.length }}</span>
      </div>
    </div>

    <!-- 列表容器 -->
    <div class="flex-1 flex items-center relative group/tray overflow-hidden min-w-0">
      <!-- 无障碍实时播报区域 -->
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        {{
          store.activeId
            ? `当前选中第 ${store.sortedImages.findIndex((i) => i.id === store.activeId) + 1} 张图片，共 ${store.images.length} 张`
            : '未选中图片'
        }}
      </div>
      <button
        v-if="canScrollLeft"
        @click="scroll('left')"
        @dblclick.stop
        class="absolute left-2 z-30 w-8 h-8 rounded-full bg-background/90 border border-border shadow-elevated flex items-center justify-center text-muted-foreground hover:text-primary transition-all active:scale-90 animate-in fade-in zoom-in duration-300"
      >
        <ChevronLeft :size="18" stroke-width="3" />
      </button>

      <div
        ref="scrollContainer"
        @scroll="checkScroll"
        @wheel="handleWheel"
        class="flex-1 h-full overflow-x-auto overflow-y-hidden custom-scrollbar-hidden flex items-center gap-3 px-6 py-2 scroll-smooth min-w-0"
      >
        <div
          v-for="img in store.sortedImages"
          :key="img.id"
          :data-id="img.id"
          class="relative shrink-0 pt-3 pb-6 transition-all duration-300"
          :class="{
            'opacity-40 scale-90 grayscale': draggedId === img.id,
            'translate-x-2': dropTargetId === img.id && draggedId !== img.id
          }"
          :draggable="store.sortMode === 'upload'"
          @dragstart="onDragStart($event, img.id)"
          @dragover="onDragOver($event, img.id)"
          @dragleave="dropTargetId = null"
          @drop="onDrop($event, img.id)"
          @dragend="onDragEnd"
        >
          <div
            @click="store.activeId = img.id"
            @keydown="handleCardKeyDown($event, img.id)"
            tabindex="0"
            class="image-card-trigger w-14 h-14 md:w-16 md:h-16 rounded-xl border-2 transition-all cursor-pointer overflow-hidden relative group/item shadow-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            :class="[
              store.activeId === img.id
                ? 'border-primary shadow-lg ring-4 ring-primary/5 scale-105 z-10'
                : 'border-border/40 hover:border-primary/40 grayscale-[0.3] hover:grayscale-0'
            ]"
          >
            <img :src="img.preview" class="w-full h-full object-cover" alt="" />
            <div
              class="absolute inset-0 transition-colors pointer-events-none"
              :class="
                store.selectedIds.has(img.id) ? 'bg-primary/20' : 'group-hover/item:bg-muted/30'
              "
            ></div>

            <!-- 勾选框 -->
            <div
              @click.stop="store.toggleSelection(img.id)"
              @keydown.stop="handleCheckboxKeyDown($event, img.id)"
              tabindex="0"
              class="absolute top-0 left-0 w-7 h-7 flex items-center justify-center z-20 cursor-pointer group/check hover:bg-muted rounded-br-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none focus-visible:z-30"
              role="checkbox"
              :aria-checked="store.selectedIds.has(img.id)"
              :aria-label="`选择图片 ${img.file.name}`"
            >
              <div
                class="w-4 h-4 rounded-md border flex items-center justify-center transition-all shadow-sm group-hover/check:scale-110 group-hover/check:border-primary"
                :class="
                  store.selectedIds.has(img.id)
                    ? 'bg-primary border-primary text-primary-foreground scale-100'
                    : 'bg-muted/80 border-border/40 opacity-0 group-hover/item:opacity-100 group-hover/check:opacity-100 scale-90'
                "
              >
                <CheckCircle2 v-if="store.selectedIds.has(img.id)" :size="10" stroke-width="3" />
                <div
                  v-else
                  class="w-1.5 h-1.5 rounded-full bg-primary/40 opacity-0 group-hover/check:opacity-100 transition-opacity"
                ></div>
              </div>
            </div>

            <div
              v-if="img.status !== 'idle'"
              class="absolute bottom-1.5 right-1.5 p-0.5 rounded-md bg-background/60 backdrop-blur-md shadow-sm z-10"
            >
              <!-- 核心修复：如果是处理中，使用纯 CSS 旋转圆环 -->
              <div
                v-if="img.status === 'processing'"
                class="w-2.5 h-2.5 border border-primary/30 border-t-primary rounded-full animate-spin transform-gpu"
                style="will-change: transform"
              ></div>
              <component
                v-else
                :size="10"
                :is="getStatusIcon(img.status)"
                :class="{
                  'text-green-400': img.status === 'done',
                  'text-red-400': img.status === 'error'
                }"
              />
            </div>
          </div>

          <!-- 活动指示 -->
          <div
            class="absolute bottom-3 left-1/2 -translate-x-1/2 h-1 bg-primary rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]"
            :class="store.activeId === img.id ? 'w-6 opacity-100' : 'w-0 opacity-0'"
          ></div>
        </div>
      </div>

      <button
        v-if="canScrollRight"
        @click="scroll('right')"
        @dblclick.stop
        class="absolute right-2 z-30 w-8 h-8 rounded-full bg-background/90 border border-border shadow-elevated flex items-center justify-center text-muted-foreground hover:text-primary transition-all active:scale-90 animate-in fade-in zoom-in duration-300"
      >
        <ChevronRight :size="18" stroke-width="3" />
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
  box-shadow: 0 -10px 40px -10px hsla(var(--shadow-color), 0.1);
}
.fade-pop-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-pop-leave-active {
  transition: all 0.2s ease-in;
}
.fade-pop-enter-from,
.fade-pop-leave-to {
  opacity: 0;
  transform: scale(0.5);
}
</style>
