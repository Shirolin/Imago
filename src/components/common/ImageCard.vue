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
    class="relative bg-card rounded-xl md:rounded-[20px] overflow-hidden border transition-all duration-300 cursor-pointer flex flex-col group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 @container"
    :class="[
      isSelected
        ? 'border-primary bg-primary/5 shadow-[0_0_0_2px_var(--primary)]'
        : 'border-border md:hover:border-primary md:hover:-translate-y-1 md:hover:shadow-2xl md:hover:shadow-black/10'
    ]"
    @click="emit('toggle', image.id)"
    @keydown.space.prevent="emit('toggle', image.id)"
    @keydown.enter.prevent="emit('toggle', image.id)"
    tabindex="0"
    role="checkbox"
    :aria-checked="isSelected"
    :aria-label="`图片 ${image.file.name}`"
  >
    <!-- ... Selection and Preview area ... -->
    <div
      class="absolute top-2 left-2 z-10 transition-all duration-200 drop-shadow-md"
      :class="isSelected ? 'text-primary opacity-100' : 'text-white opacity-70'"
    >
      <CheckSquare v-if="isSelected" class="w-[clamp(14px,6cqw,18px)] h-[clamp(14px,6cqw,18px)]" />
      <Square v-else class="w-[clamp(14px,6cqw,18px)] h-[clamp(14px,6cqw,18px)]" />
    </div>

    <div
      class="relative aspect-[4/3] overflow-hidden bg-slate-900 flex items-center justify-center"
    >
      <img
        :src="image.preview"
        alt="Preview"
        class="w-full h-full object-contain transition-transform duration-500 md:group-hover:scale-[1.08]"
      />
      <div
        v-if="image.status === 'processing'"
        class="absolute inset-0 bg-slate-900/75 flex items-center justify-center backdrop-blur-[2px]"
      >
        <Loader2 class="animate-spin text-primary" :size="24" />
      </div>
      <div
        v-if="image.status === 'done'"
        class="absolute top-2 right-2 bg-primary text-primary-foreground w-[clamp(20px,8cqw,24px)] h-[clamp(20px,8cqw,24px)] rounded-full flex items-center justify-center shadow-lg shadow-primary/40"
      >
        <CheckCircle2 class="w-[65%] h-[65%]" />
      </div>
      <slot name="overlay" :image="image"></slot>
    </div>

    <!-- 元数据 -->
    <div class="p-[clamp(0.5rem,4cqw,0.875rem)] flex flex-col gap-[clamp(0.4rem,3cqw,0.625rem)]">
      <div class="flex justify-between items-start gap-2">
        <span
          class="font-bold text-foreground overflow-hidden text-ellipsis leading-tight [text-wrap:balance] hyphens-auto"
          style="font-size: clamp(0.75rem, 4.5cqw, 0.875rem);"
          :title="image.file.name"
        >
          {{ image.file.name }}
        </span>
        <span
          class="font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap"
          style="font-size: clamp(0.6rem, 3.5cqw, 0.75rem);"
        >
          {{ formatSize(image.originalSize) }}
        </span>
      </div>

      <div class="flex justify-between items-center gap-2">
        <!-- 状态胶囊 -->
        <div
          class="flex items-center gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 rounded-full font-bold border shrink-0"
          style="font-size: clamp(0.6rem, 3.5cqw, 0.75rem);"
          :class="{
            'text-primary border-primary/30 bg-background': image.status === 'done',
            'text-blue-500 border-blue-500/30 bg-background': image.status === 'processing',
            'text-destructive border-destructive/30 bg-background': image.status === 'error',
            'text-foreground border-border bg-background': !image.status
          }"
        >
          <div
            class="w-1.5 h-1.5 rounded-full bg-current"
            :class="{ 'animate-pulse': image.status === 'processing' }"
          ></div>
          <span class="whitespace-nowrap">
            {{
              image.status === 'done'
                ? '完成'
                : image.status === 'error'
                  ? '失败'
                  : image.status === 'processing'
                    ? '处理中'
                    : '待处理'
            }}
          </span>
        </div>

        <button
          v-if="image.status === 'done'"
          class="bg-muted hover:bg-primary hover:text-primary-foreground text-foreground rounded-lg md:rounded-[10px] flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
          style="width: clamp(1.5rem, 8cqw, 2rem); height: clamp(1.5rem, 8cqw, 2rem);"
          @click.stop="emit('download', image.id)"
          aria-label="下载处理后的图片"
        >
          <Download class="w-1/2 h-1/2" />
        </button>
      </div>
      <slot name="meta" :image="image"></slot>
    </div>

    <!-- 删除按钮 -->
    <button
      @click.stop="emit('remove', image.id)"
      class="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center cursor-pointer shadow-lg shadow-destructive/30 z-10 transition-all duration-300"
      style="width: clamp(1.25rem, 7cqw, 1.625rem); height: clamp(1.25rem, 7cqw, 1.625rem);"
      :class="[
        isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-50 md:group-hover:opacity-100 md:group-hover:scale-100'
      ]"
      aria-label="删除此图片"
    >
      <X class="w-[60%] h-[60%]" />
    </button>
  </div>
</template>
