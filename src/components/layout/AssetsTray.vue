<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useImageStore, type ImageItem } from '../../stores/imageStore'
import {
  Trash2,
  SortAsc,
  Clock,
  Timer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  MinusSquare
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

const isDeletingAll = ref(false)
const confirmClear = () => {
  if (isDeletingAll.value) {
    store.clearImages()
    isDeletingAll.value = false
  } else {
    isDeletingAll.value = true
    setTimeout(() => {
      isDeletingAll.value = false
    }, 3000)
  }
}
</script>

<template>
  <div
    class="assets-tray bg-card/80 backdrop-blur-3xl border-t border-border/40 shrink-0 z-40 h-full flex flex-col overflow-hidden select-none w-full min-w-0"
  >
    <!-- 头部工具栏 (极简图标版) -->
    <div
      class="flex items-center justify-between px-3 h-8 border-b border-border/20 bg-muted/5 shrink-0"
    >
      <div class="flex items-center gap-2">
        <!-- 排序 -->
        <button
          @click="handleSortChange"
          :title="sortTitle"
          :aria-label="sortTitle"
          class="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all focus-visible:ring-2 focus-visible:ring-primary outline-none"
        >
          <Clock v-if="store.sortMode === 'upload'" :size="14" />
          <SortAsc v-else-if="store.sortMode === 'name'" :size="14" />
          <Timer v-else :size="14" />
        </button>

        <div class="h-3 w-px bg-border/30 mx-1"></div>

        <!-- 批量操作 -->
        <button
          @click="store.toggleAll"
          :title="store.isAllSelected ? '取消全选' : '全选图片'"
          :aria-label="store.isAllSelected ? '取消全选' : '全选图片'"
          class="p-1.5 rounded-md transition-all focus-visible:ring-2 focus-visible:ring-primary outline-none"
          :class="
            store.isAllSelected
              ? 'text-primary bg-primary/5'
              : 'text-muted-foreground hover:text-foreground'
          "
        >
          <component
            :is="store.isAllSelected ? CheckSquare : store.selectedCount > 0 ? MinusSquare : Square"
            :size="14"
          />
        </button>

        <Transition name="fade-pop">
          <button
            v-if="store.selectedCount > 0"
            @click="store.removeSelected"
            :title="`删除选中的 ${store.selectedCount} 张图片`"
            :aria-label="`删除选中的 ${store.selectedCount} 张图片`"
            class="p-1.5 rounded-md text-destructive/70 hover:text-destructive hover:bg-destructive/5 transition-all focus-visible:ring-2 focus-visible:ring-destructive outline-none"
          >
            <Trash2 :size="14" />
          </button>
        </Transition>

        <div class="h-3 w-px bg-border/30 mx-1"></div>

        <!-- 图片统计 -->
        <div
          class="text-[9px] font-black text-muted-foreground/30 uppercase tracking-tighter"
          aria-hidden="true"
        >
          {{ store.images.length }}<span class="opacity-40 ml-0.5">FILES</span>
        </div>
      </div>

      <div class="flex items-center">
        <!-- 清空队列 -->
        <button
          @click="confirmClear"
          :title="isDeletingAll ? '确认清空所有图片？' : '清空队列'"
          :aria-label="isDeletingAll ? '确认清空所有图片？' : '清空队列'"
          class="flex items-center justify-center min-w-[32px] h-6 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-destructive outline-none"
          :class="
            isDeletingAll
              ? 'bg-destructive px-3 shadow-lg'
              : 'p-1.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5'
          "
        >
          <Trash2 v-if="!isDeletingAll" :size="14" />
          <span v-else class="text-[9px] font-black text-white uppercase animate-in zoom-in-90"
            >Confirm?</span
          >
        </button>
      </div>
    </div>

    <!-- 列表容器 -->
    <div class="flex-1 flex items-center relative group/tray overflow-hidden min-w-0">
      <!-- 左导航 -->
      <button
        v-if="canScrollLeft"
        @click="scroll('left')"
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
          class="relative shrink-0 pt-2 pb-5"
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
              @click.stop="store.toggleSelection(img.id)"
              class="absolute inset-0 transition-colors"
              :class="
                store.selectedIds.has(img.id) ? 'bg-primary/10' : 'group-hover/item:bg-black/5'
              "
            ></div>

            <!-- 勾选框 (增加热区至 44x44px) -->
            <div
              @click.stop="store.toggleSelection(img.id)"
              class="absolute top-0 left-0 w-10 h-10 flex items-start justify-start p-1.5 z-20 cursor-pointer group/check"
              role="checkbox"
              :aria-checked="store.selectedIds.has(img.id)"
              aria-label="选中图片"
            >
              <div
                class="w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all shadow-sm"
                :class="
                  store.selectedIds.has(img.id)
                    ? 'bg-primary border-primary text-primary-foreground scale-100'
                    : 'bg-white/80 border-black/10 opacity-0 group-hover/item:opacity-100 scale-90'
                "
              >
                <CheckCircle2 v-if="store.selectedIds.has(img.id)" :size="11" stroke-width="3" />
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

          <!-- 单个删除 -->
          <button
            @click.stop="store.removeImage(img.id)"
            class="absolute -top-1 -right-3 w-10 h-10 flex items-center justify-center z-30 group/delete transition-all"
            :class="isPC ? 'opacity-0 group-hover/item:opacity-100' : 'opacity-100'"
            :aria-label="`移除图片 ${img.file.name}`"
          >
            <div
              class="w-5 h-5 bg-background border border-border text-muted-foreground hover:text-destructive rounded-full shadow-lg flex items-center justify-center scale-75 group-hover/delete:scale-100 transition-transform"
            >
              <X :size="10" stroke-width="3" />
            </div>
          </button>

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
