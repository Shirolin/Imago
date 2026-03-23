<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
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
import { useBreakpoints } from '../../composables/useBreakpoints'

const store = useImageStore()
const { isPC } = useBreakpoints()

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
    setTimeout(() => {
      const activeEl = scrollContainer.value?.querySelector(`[data-id="${id}"]`) as HTMLElement
      if (activeEl && scrollContainer.value) {
        const container = scrollContainer.value
        const scrollLeft =
          activeEl.offsetLeft - container.clientWidth / 2 + activeEl.offsetWidth / 2
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
      }
    }, 50)
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
  const currentIndex = modes.indexOf(store.sortMode as any)
  const nextMode = modes[(currentIndex + 1) % modes.length]
  if (nextMode) store.sortMode = nextMode
}

// 保持排序标题
const sortTitle = computed(() => {
  if (store.sortMode === 'upload') return '当前排序: 上传时间 (点击切换)'
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
  if (nextImg) store.activeId = nextImg.id
}

const handleGlobalKeyDown = (e: KeyboardEvent) => {
  // 确保不在输入框内触发
  const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
  if (isInput) return

  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    navigate('prev')
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    navigate('next')
  } else if (e.key === 'Tab') {
    // 仅在有多图时允许折叠，避免操作空间被误关
    if (store.images.length > 1) {
      e.preventDefault()
      // 实际上在 WorkspaceLayout 中已经可以控制，但这里提供 Tab 快捷键
    }
  }
}

// 注意：Tab 键监听通常需要在更全局的地方，但为了模块化先放在这里
// 我们通过 props 或 layoutStore 注入
const handleKeyDownInternal = (e: KeyboardEvent) => {
  handleGlobalKeyDown(e)
}

onMounted(() => window.addEventListener('keydown', handleKeyDownInternal))
onUnmounted(() => window.removeEventListener('keydown', handleKeyDownInternal))

// --- 增强：拖拽排序 ---
const draggedId = ref<string | null>(null)
const dropTargetId = ref<string | null>(null)

const onDragStart = (e: DragEvent, id: string) => {
  if (store.sortMode !== 'upload') return // 仅在默认排序下允许手动排序
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
    // 逻辑：在 store.images 中寻找位置并交换
    // 因为 sortedImages 是 images.reverse()，我们需要考虑转换
    // 为了简单，我们直接在 store 中操作
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
    <!-- 头部工具栏 (极简导航版) -->
    <div
      class="flex items-center justify-between px-3 h-7 border-b border-border/10 bg-muted/5 shrink-0"
    >
      <div class="flex items-center gap-2">
        <!-- 排序 -->
        <button
          @click="handleSortChange"
          @dblclick.stop
          :title="sortTitle"
          :aria-label="sortTitle"
          class="p-1.5 rounded-md text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-all focus-visible:ring-2 focus-visible:ring-primary outline-none"
        >
          <Clock v-if="store.sortMode === 'upload'" :size="12" />
          <SortAsc v-else-if="store.sortMode === 'name'" :size="12" />
          <Timer v-else :size="12" />
        </button>

        <div class="h-2.5 w-px bg-border/20 mx-0.5"></div>

        <!-- 左侧：导航工具 -->
        <div class="flex items-center gap-2 md:gap-4 shrink-0">
          <!-- 切换按钮组 -->
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
      </div>

      <!-- 右侧：统计 -->
      <div class="flex items-center gap-1.5 mr-1">
        <span
          class="text-[0.6rem] font-black text-muted-foreground/40 uppercase tracking-widest mr-1"
          >Items</span
        >
        <span class="text-[0.65rem] font-mono font-bold text-primary">{{
          store.images.length
        }}</span>
      </div>
    </div>

    <!-- 列表容器 -->
    <div class="flex-1 flex items-center relative group/tray overflow-hidden min-w-0">
      <!-- 左导航 -->
      <button
        v-if="canScrollLeft"
        @click="scroll('left')"
        @dblclick.stop
        aria-label="向左滚动"
        class="absolute left-2 z-30 w-8 h-8 rounded-full bg-background/90 border border-border shadow-elevated flex items-center justify-center text-muted-foreground hover:text-primary transition-all active:scale-90 animate-in fade-in zoom-in duration-300"
      >
        <ChevronLeft :size="18" stroke-width="3" />
      </button>

      <div
        ref="scrollContainer"
        @scroll="checkScroll"
        @wheel="handleWheel"
        class="flex-1 h-full overflow-x-auto overflow-y-hidden custom-scrollbar-hidden flex items-center gap-3 px-6 scroll-smooth min-w-0"
      >
        <div
          v-for="img in store.sortedImages"
          :key="img.id"
          :data-id="img.id"
          class="relative shrink-0 pt-2 pb-5 transition-all duration-300"
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
            class="w-14 h-14 md:w-16 md:h-16 rounded-xl border-2 transition-all cursor-pointer overflow-hidden relative group/item shadow-sm"
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
                store.selectedIds.has(img.id) ? 'bg-primary/20' : 'group-hover/item:bg-black/5'
              "
            ></div>

            <!-- 勾选框 (优化热区与视觉反馈) -->
            <div
              @click.stop="store.toggleSelection(img.id)"
              class="absolute top-0 left-0 w-7 h-7 flex items-center justify-center z-20 cursor-pointer group/check hover:bg-black/20 dark:hover:bg-white/20 rounded-br-lg transition-colors"
              role="checkbox"
              :aria-checked="store.selectedIds.has(img.id)"
              aria-label="选中图片"
            >
              <div
                class="w-4 h-4 rounded-md border flex items-center justify-center transition-all shadow-sm group-hover/check:scale-110 group-hover/check:border-primary"
                :class="
                  store.selectedIds.has(img.id)
                    ? 'bg-primary border-primary text-primary-foreground scale-100'
                    : 'bg-white/90 border-black/20 opacity-0 group-hover/item:opacity-100 group-hover/check:opacity-100 scale-90'
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
              class="absolute bottom-1.5 right-1.5 p-0.5 rounded-md bg-black/60 backdrop-blur-md shadow-sm z-10"
            >
              <component
                :is="getStatusIcon(img.status)"
                :size="10"
                :class="{
                  'animate-spin text-white': img.status === 'processing',
                  'text-green-400': img.status === 'done',
                  'text-red-400': img.status === 'error'
                }"
              />
            </div>
          </div>

          <!-- 活动指示 (保持充足的底部呼吸感) -->
          <div
            class="absolute bottom-2.5 left-1/2 -translate-x-1/2 h-1 bg-primary rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]"
            :class="store.activeId === img.id ? 'w-6 opacity-100' : 'w-0 opacity-0'"
          ></div>
        </div>
      </div>

      <!-- 右导航 -->
      <button
        v-if="canScrollRight"
        @click="scroll('right')"
        @dblclick.stop
        aria-label="向右滚动"
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
  box-shadow: 0 -10px 40px -10px rgba(0, 0, 0, 0.1);
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
