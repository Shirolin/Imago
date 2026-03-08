<script setup lang="ts">
import { Download, X, Loader2, CheckCircle2, Square, CheckSquare } from 'lucide-vue-next'
import { useFileHelpers } from '../../composables/useFileHelpers'
import type { ImageItem } from '../../stores/imageStore'

const { formatSize } = useFileHelpers()

interface Props {
  image: ImageItem
  isSelected?: boolean
}

defineProps<Props>()
const emit = defineEmits(['toggle', 'remove', 'download'])
</script>

<template>
  <div
    class="relative bg-card rounded-[20px] overflow-hidden border transition-all duration-300 cursor-pointer flex flex-col group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
    :class="[
      isSelected
        ? 'border-primary bg-primary/5 shadow-[0_0_0_2px_var(--primary)]'
        : 'border-border hover:border-primary hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10'
    ]"
    @click="emit('toggle', image.id)"
    @keydown.space.prevent="emit('toggle', image.id)"
    @keydown.enter.prevent="emit('toggle', image.id)"
    tabindex="0"
    role="checkbox"
    :aria-checked="isSelected"
    :aria-label="`图片 ${image.file.name}`"
  >
    <!-- 选择框 -->
    <div
      class="absolute top-3 left-3 z-10 transition-all duration-200 drop-shadow-md"
      :class="isSelected ? 'text-primary opacity-100' : 'text-white opacity-70'"
    >
      <CheckSquare v-if="isSelected" :size="18" />
      <Square v-else :size="18" />
    </div>

    <!-- 预览图区域 -->
    <div
      class="relative aspect-[4/3] overflow-hidden bg-slate-900 flex items-center justify-center"
    >
      <img
        :src="image.preview"
        alt="Preview"
        class="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.08]"
      />

      <!-- 加载中 -->
      <div
        v-if="image.status === 'processing'"
        class="absolute inset-0 bg-slate-900/75 flex items-center justify-center backdrop-blur-[2px]"
      >
        <Loader2 class="animate-spin text-primary" :size="32" />
      </div>

      <!-- 完成标识 (默认) -->
      <div
        v-if="image.status === 'done'"
        class="absolute top-3 right-3 bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center shadow-lg shadow-primary/40"
      >
        <CheckCircle2 :size="16" />
      </div>

      <!-- 特定功能的插槽 (如压缩率) -->
      <slot name="overlay" :image="image"></slot>
    </div>

    <!-- 元数据 -->
    <div class="p-3.5 flex flex-col gap-2.5">
      <div class="flex justify-between items-center gap-2">
        <span
          class="text-sm font-bold text-foreground whitespace-nowrap overflow-hidden text-ellipsis leading-tight"
          :title="image.file.name"
        >
          {{ image.file.name }}
        </span>
        <span
          class="text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md self-start"
        >
          {{ formatSize(image.originalSize) }}
        </span>
      </div>

      <div class="flex justify-between items-center">
        <!-- 状态胶囊 -->
        <div
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
          :class="{
            'text-primary border-primary/30 bg-background': image.status === 'done',
            'text-blue-500 border-blue-500/30 bg-background': image.status === 'processing',
            'text-destructive border-destructive/30 bg-background': image.status === 'error',
            'text-foreground border-border bg-background': !image.status
          }"
        >
          <div
            class="w-2 h-2 rounded-full bg-current"
            :class="{ 'animate-pulse': image.status === 'processing' }"
          ></div>
          <span>
            {{
              image.status === 'done'
                ? '处理完成'
                : image.status === 'error'
                  ? image.error || '失败'
                  : image.status === 'processing'
                    ? '处理中...'
                    : '等待处理'
            }}
          </span>
        </div>

        <button
          v-if="image.status === 'done'"
          class="bg-muted hover:bg-primary hover:text-primary-foreground text-foreground w-8 h-8 rounded-[10px] flex items-center justify-center cursor-pointer transition-all hover:scale-110"
          @click.stop="emit('download', image.id)"
          aria-label="下载处理后的图片"
        >
          <Download :size="14" />
        </button>
      </div>

      <!-- 特定功能的元数据插槽 -->
      <slot name="meta" :image="image"></slot>
    </div>

    <!-- 删除按钮 -->
    <button
      @click.stop="emit('remove', image.id)"
      class="absolute top-2 right-2 w-[26px] h-[26px] bg-destructive text-destructive-foreground rounded-full flex items-center justify-center cursor-pointer opacity-0 scale-50 transition-all duration-300 shadow-lg shadow-destructive/30 z-10 group-hover:opacity-100 group-hover:scale-100 hover:!scale-110 hover:!bg-red-700"
      :class="{ 'opacity-100 !scale-100': isSelected }"
      aria-label="删除此图片"
    >
      <X :size="14" />
    </button>
  </div>
</template>
