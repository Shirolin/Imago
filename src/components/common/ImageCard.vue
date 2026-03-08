<script setup lang="ts">
import { Download, X, Loader2, CheckCircle2, Square, CheckSquare, Columns2 } from 'lucide-vue-next'
import { useFileHelpers } from '../../composables/useFileHelpers'
import type { ImageItem } from '../../stores/imageStore'

const { formatSize } = useFileHelpers()

interface Props {
  image: ImageItem
  isSelected?: boolean
}

defineProps<Props>()
const emit = defineEmits(['toggle', 'remove', 'download', 'compare'])
</script>

<template>
  <div
    class="relative bg-card rounded-xl md:rounded-[20px] overflow-hidden border transition-all duration-300 cursor-pointer flex flex-col group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 @container"
    :class="[
      isSelected
        ? 'border-primary bg-primary/5 shadow-[0_0_0_2px_var(--primary)]'
        : 'border-border md:hover:border-primary md:hover:-translate-y-1 md:hover:shadow-2xl md:hover:shadow-black/10'
    ]"
    @click="emit('toggle', image.id)"
    tabindex="0"
    role="checkbox"
    :aria-checked="isSelected"
  >
    <!-- 选择框 -->
    <div
      class="absolute top-2 left-2 z-20 transition-all duration-200 drop-shadow-md"
      :class="isSelected ? 'text-primary opacity-100' : 'text-white opacity-70'"
    >
      <CheckSquare v-if="isSelected" class="w-[clamp(14px,6cqw,18px)] h-[clamp(14px,6cqw,18px)]" />
      <Square v-else class="w-[clamp(14px,6cqw,18px)] h-[clamp(14px,6cqw,18px)]" />
    </div>

    <!-- 图片预览区 -->
    <div class="relative aspect-[4/3] overflow-hidden bg-slate-900 flex items-center justify-center">
      <img
        :src="image.preview"
        alt="Preview"
        class="w-full h-full object-contain transition-transform duration-500 md:group-hover:scale-[1.05]"
      />
      
      <!-- 居中对比按钮 (仅在完成时显示) -->
      <div 
        v-if="image.status === 'done'"
        class="absolute inset-0 z-30 flex items-center justify-center bg-black/20 opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-[1px]"
      >
        <button
          type="button"
          @click.stop="emit('compare', image.id)"
          class="bg-white text-black hover:bg-primary hover:text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transform translate-y-2 md:group-hover:translate-y-0 transition-all duration-300 shadow-2xl shadow-black/40 cursor-pointer active:scale-90"
        >
          <Columns2 :size="14" />
          对比画质
        </button>
      </div>

      <!-- 处理中遮罩 -->
      <div
        v-if="image.status === 'processing'"
        class="absolute inset-0 bg-slate-900/75 flex items-center justify-center backdrop-blur-[2px] z-10"
      >
        <Loader2 class="animate-spin text-primary" :size="24" />
      </div>

      <!-- 完成角标 -->
      <div
        v-if="image.status === 'done'"
        class="absolute top-2 right-2 bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center shadow-lg z-20"
      >
        <CheckCircle2 class="w-4 h-4" />
      </div>
      
      <slot name="overlay" :image="image"></slot>
    </div>

    <!-- 元数据 -->
    <div class="p-3 flex flex-col gap-2">
      <div class="flex justify-between items-start gap-2">
        <span class="font-bold text-[0.8125rem] text-foreground truncate" :title="image.file.name">
          {{ image.file.name }}
        </span>
        <span class="font-semibold text-[0.65rem] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
          {{ formatSize(image.originalSize) }}
        </span>
      </div>

      <div class="flex justify-between items-center gap-2 mt-auto">
        <!-- 状态标签 -->
        <div
          class="flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold text-[0.65rem] border shrink-0"
          :class="{
            'text-primary border-primary/20 bg-primary/5': image.status === 'done',
            'text-blue-500 border-blue-500/20 bg-blue-500/5': image.status === 'processing',
            'text-destructive border-destructive/20 bg-destructive/5': image.status === 'error',
            'text-muted-foreground border-border bg-muted/20': image.status === 'idle'
          }"
        >
          <div class="w-1 h-1 rounded-full bg-current" :class="{ 'animate-pulse': image.status === 'processing' }"></div>
          <span>{{ image.status === 'done' ? '已完成' : image.status === 'processing' ? '处理中' : '待处理' }}</span>
        </div>

        <!-- 动作按钮组 -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            v-if="image.status === 'done'"
            type="button"
            @click.stop="emit('compare', image.id)"
            class="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer"
            title="查看对比"
          >
            <Columns2 :size="16" />
          </button>
          
          <button
            v-if="image.status === 'done'"
            type="button"
            @click.stop="emit('download', image.id)"
            class="w-8 h-8 flex items-center justify-center rounded-lg bg-muted text-foreground hover:bg-primary hover:text-white transition-colors cursor-pointer"
            title="下载图片"
          >
            <Download :size="16" />
          </button>
        </div>
      </div>
      <slot name="meta" :image="image"></slot>
    </div>

    <!-- 删除按钮 -->
    <button
      @click.stop="emit('remove', image.id)"
      class="absolute top-1.5 right-1.5 bg-destructive text-white rounded-full flex items-center justify-center shadow-lg z-40 transition-all duration-300 md:opacity-0 md:group-hover:opacity-100"
      style="width: 1.5rem; height: 1.5rem"
    >
      <X :size="14" />
    </button>
  </div>
</template>
