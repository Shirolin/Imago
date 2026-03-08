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
    class="relative bg-card rounded-2xl overflow-hidden border border-border/60 transition-all duration-500 cursor-pointer flex flex-col group hover:shadow-2xl hover:shadow-black/5 hover:border-primary/30 @container"
    :class="[
      isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/[0.01]' : ''
    ]"
    @click="emit('toggle', image.id)"
  >
    <!-- 图片展示区 -->
    <div
      class="relative aspect-[4/3] overflow-hidden bg-slate-900 flex items-center justify-center shrink-0"
    >
      <!-- 【左上角】：选择框 + 业务贴纸插槽 (错位排列) -->
      <div class="absolute top-3 left-3 z-30 flex items-center gap-2">
        <div
          class="transition-all duration-300"
          :class="
            isSelected
              ? 'text-primary scale-110'
              : 'text-white/40 opacity-0 group-hover:opacity-100'
          "
        >
          <CheckSquare v-if="isSelected" :size="20" />
          <Square v-else :size="20" />
        </div>

        <!-- 业务贴纸 (如：节省 50%) 放在这里，绝不挡到底部 HUD -->
        <slot name="overlay" :image="image"></slot>
      </div>

      <!-- 【右上角】：删除按钮 -->
      <button
        @click.stop="emit('remove', image.id)"
        class="absolute top-2.5 right-2.5 z-30 bg-destructive/10 hover:bg-destructive text-destructive hover:text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-md active:scale-90"
      >
        <X :size="14" />
      </button>

      <img
        :src="image.preview"
        alt="Preview"
        class="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
      />

      <!-- 对比预览悬浮 -->
      <div
        v-if="image.status === 'done'"
        class="absolute inset-0 z-10 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-500 backdrop-blur-[2px]"
      >
        <button
          type="button"
          @click.stop="emit('compare', image.id)"
          class="bg-white text-black hover:bg-primary hover:text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 shadow-2xl"
        >
          <Columns2 :size="14" />
          对比画质
        </button>
      </div>

      <!-- 【底部 HUD】：技术参数条 (移动端始终可见，桌面端悬停可见) -->
      <div
        class="absolute bottom-0 left-0 right-0 h-9 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-20 flex items-end px-3 pb-1.5 transition-opacity duration-500 md:opacity-0 md:group-hover:opacity-100 pointer-events-none"
      >
        <div class="flex items-center gap-2 text-[0.6rem] font-bold text-white/90 tabular-nums">
          <span
            class="px-1.5 py-0.5 bg-white/20 rounded-sm uppercase text-white tracking-widest text-[0.55rem]"
            >{{ image.format }}</span
          >
          <span v-if="image.width" class="opacity-90">{{ image.width }} × {{ image.height }}</span>
          <span class="opacity-30">|</span>
          <span class="opacity-90">{{ formatSize(image.originalSize) }}</span>
        </div>
      </div>

      <!-- 处理中状态 -->
      <div
        v-if="image.status === 'processing'"
        class="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-40 flex items-center justify-center"
      >
        <Loader2 class="animate-spin text-primary" :size="24" />
      </div>
    </div>

    <!-- 底部：文件名与操作 -->
    <div class="p-3.5 flex flex-col gap-2.5">
      <h4
        class="font-bold text-[0.85rem] text-foreground truncate leading-none"
        :title="image.file.name"
      >
        {{ image.file.name }}
      </h4>

      <div class="flex justify-between items-center gap-2 mt-0.5 min-h-[32px]">
        <div
          class="flex items-center gap-1.5 px-2 h-6 rounded-md font-black text-[0.6rem] border transition-all duration-300 uppercase tracking-widest"
          :class="{
            'text-primary border-primary/20 bg-primary/[0.03]': image.status === 'done',
            'text-blue-500 border-blue-500/20 bg-blue-500/[0.03]': image.status === 'processing',
            'text-destructive border-destructive/20 bg-destructive/[0.03]':
              image.status === 'error',
            'text-muted-foreground border-border bg-muted/20': image.status === 'idle'
          }"
        >
          <div class="w-2.5 h-2.5 flex items-center justify-center">
            <CheckCircle2 v-if="image.status === 'done'" :size="10" />
            <div
              v-else
              class="w-1.5 h-1.5 rounded-full bg-current"
              :class="{ 'animate-pulse': image.status === 'processing' }"
            ></div>
          </div>
          <span>{{
            image.status === 'done' ? 'Ready' : image.status === 'processing' ? 'Wait' : 'Idle'
          }}</span>
        </div>

        <div class="flex items-center gap-1">
          <button
            v-if="image.status === 'done'"
            @click.stop="emit('compare', image.id)"
            class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all active:scale-90"
            title="对比"
          >
            <Columns2 :size="16" />
          </button>

          <button
            v-if="image.status === 'done'"
            @click.stop="emit('download', image.id)"
            class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary text-muted-foreground hover:text-white transition-all active:scale-90"
            title="下载"
          >
            <Download :size="16" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
