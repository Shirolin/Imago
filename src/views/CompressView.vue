<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import imageCompression from 'browser-image-compression'
import { Zap, Plus, Trash2, ArrowRight, Square, CheckSquare } from 'lucide-vue-next'

const store = useImageStore()
const { fileInput, formatSize, triggerFileInput, handleFileChange, downloadImage } =
  useFileHelpers()

const compressionQuality = ref(0.8)
const isCompressing = ref(false)

const compressImage = async (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (!item) return

  const abortController = new AbortController()
  store.updateImage(id, { status: 'processing', abortController })

  try {
    const options = {
      maxSizeMB: 10,
      maxWidthOrHeight: 4096,
      useWebWorker: true,
      initialQuality: compressionQuality.value,
      signal: abortController.signal
    }

    const compressedFile = await imageCompression(item.file, options)

    // 如果压缩后反而变大了（由于小体积或者已有损格式导致）
    if (compressedFile.size >= item.originalSize) {
      store.updateImage(id, {
        status: 'done',
        processedSize: item.originalSize,
        processedBlob: item.file, // 保留原图
        abortController: undefined
      })
    } else {
      store.updateImage(id, {
        status: 'done',
        processedSize: compressedFile.size,
        processedBlob: compressedFile,
        abortController: undefined
      })
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('abort')) {
      console.log(`[Task Aborted] Compression cancelled for ${id}`)
      return
    }
    console.error('Compression failed:', error)
    store.updateImage(id, { status: 'error', error: '压缩失败', abortController: undefined })
  }
}

const compressAll = async () => {
  isCompressing.value = true
  const idleImages = store.images.filter((img) => img.status !== 'done')
  await Promise.all(idleImages.map((img) => compressImage(img.id)))
  isCompressing.value = false
}

const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) {
    downloadImage(item.processedBlob, item.file.name, 'compressed_')
  }
}
</script>

<template>
  <WorkspaceLayout>
    <template #header-left>
      <div class="flex items-center gap-3 md:gap-8">
        <div
          class="flex items-center gap-2 md:gap-3.5 cursor-pointer px-3 md:px-4 py-2 md:py-2.5 rounded-xl md:rounded-2xl bg-muted border border-border transition-all duration-300 hover:border-primary hover:bg-background active:scale-[0.96] shrink-0"
          @click="store.toggleAll"
        >
          <div
            class="transition-transform duration-200"
            :class="store.isAllSelected ? 'text-primary' : 'text-muted-foreground'"
          >
            <CheckSquare v-if="store.isAllSelected" :size="18" class="md:w-5 md:h-5 drop-shadow-sm" />
            <Square v-else :size="18" class="md:w-5 md:h-5" />
          </div>
          <div class="flex flex-col">
            <span class="font-extrabold text-xs md:text-sm text-foreground leading-tight"
              >已选择 {{ store.selectedCount }}</span
            >
            <span
              class="hidden md:inline text-[0.65rem] text-muted-foreground font-bold uppercase tracking-widest mt-0.5 opacity-80"
              >全选/反选</span
            >
          </div>
        </div>

        <div class="hidden md:block w-px h-9 bg-border"></div>

        <div class="flex flex-col gap-1.5 md:gap-2 min-w-[120px] md:min-w-[180px]">
          <div
            class="flex justify-between text-[0.65rem] font-extrabold uppercase text-muted-foreground tracking-wide"
          >
            <span class="hidden md:inline">压缩质量</span>
            <span class="md:hidden">质量</span>
            <span class="text-primary bg-primary/10 px-1.5 rounded"
              >{{ Math.round(compressionQuality * 100) }}%</span
            >
          </div>
          <input
            type="range"
            v-model.number="compressionQuality"
            min="0.1"
            max="1.0"
            step="0.05"
            class="w-full h-1.5 bg-border rounded-full appearance-none outline-none cursor-pointer hover:bg-muted accent-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
          />
        </div>
      </div>
    </template>

    <!-- 核心操作传送至顶栏 -->
    <Teleport to="#top-bar-tools">
      <input
        type="file"
        ref="fileInput"
        multiple
        accept="image/*"
        @change="handleFileChange"
        class="hidden"
      />

      <div class="flex items-center gap-1.5 md:gap-2">
        <AppButton variant="secondary" size="sm" @click="triggerFileInput" class="!px-2.5 md:!px-3 !h-8 md:!h-9 !text-xs md:!text-sm">
          <template #icon><Plus :size="14" class="md:w-4 md:h-4 mr-1 md:mr-1.5" /></template>
          添加
        </AppButton>
        <AppButton
          variant="secondary"
          size="sm"
          :disabled="!store.selectedCount || isCompressing"
          @click="store.removeSelected"
          class="!px-2.5 md:!px-3 !h-8 md:!h-9 !text-xs md:!text-sm text-destructive border-transparent hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <template #icon><Trash2 :size="14" class="md:w-4 md:h-4 mr-1 md:mr-1.5" /></template>
          删除
        </AppButton>
      </div>

      <div class="w-px h-5 md:h-6 bg-border mx-1 md:mx-2"></div>

      <AppButton
        variant="cta"
        size="sm"
        :loading="isCompressing"
        :disabled="!store.images.length"
        @click="compressAll"
        class="!px-3 md:!px-4 !h-8 md:!h-9 !text-xs md:!text-sm"
      >
        <template #icon>
          <Zap v-if="!isCompressing" :size="14" class="md:w-4 md:h-4 mr-1 md:mr-1.5" />
        </template>
        处理全部
      </AppButton>
    </Teleport>

    <template #content>
      <ImageCard
        v-for="img in store.images"
        :key="img.id"
        :image="img"
        :is-selected="store.selectedIds.has(img.id)"
        @toggle="store.toggleSelection"
        @remove="store.removeImage"
        @download="handleDownload"
      >
        <template #overlay="{ image }">
          <div
            v-if="image.status === 'done'"
            class="absolute top-2 md:top-3 right-2 md:right-3 px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-[10px] text-[0.6rem] md:text-xs font-extrabold flex items-center gap-1 md:gap-1.5 shadow-lg z-10 backdrop-blur-sm animate-in fade-in slide-in-from-top-2"
            :class="
              image.processedSize === image.originalSize
                ? 'bg-muted/90 text-muted-foreground border border-border shadow-black/10'
                : 'bg-primary text-primary-foreground shadow-primary/40'
            "
          >
            <template v-if="image.processedSize === image.originalSize">
              <span>已跳过</span>
            </template>
            <template v-else>
              <Zap :size="10" class="md:w-3 md:h-3" /> 节省
              {{ Math.round((1 - image.processedSize! / image.originalSize) * 100) }}%
            </template>
          </div>
        </template>

        <template #meta="{ image }">
          <div
            class="flex items-center gap-2 md:gap-3 bg-background p-2 md:p-3 rounded-xl md:rounded-2xl mt-1.5 border border-border transition-all duration-300 group-hover:border-primary/20"
          >
            <div class="flex-1 flex flex-col gap-0.5">
              <span
                class="text-[0.6rem] md:text-[0.65rem] font-extrabold uppercase text-muted-foreground tracking-widest mt-0.5 opacity-80"
                >原始</span
              >
              <span class="text-[0.75rem] md:text-[0.8125rem] font-bold text-foreground">{{
                formatSize(image.originalSize)
              }}</span>
            </div>
            <div class="text-muted-foreground/60 flex shrink-0">
              <ArrowRight :size="12" class="md:w-3.5 md:h-3.5" />
            </div>
            <div class="flex-1 flex flex-col gap-0.5">
              <span
                class="text-[0.6rem] md:text-[0.65rem] font-extrabold uppercase text-muted-foreground tracking-widest mt-0.5 opacity-80"
                >压缩后</span
              >
              <span
                class="text-[0.75rem] md:text-[0.8125rem] font-bold transition-colors"
                :class="image.status === 'done' ? 'text-primary' : 'text-foreground'"
                >{{ image.status === 'done' ? formatSize(image.processedSize!) : '--' }}</span
              >
            </div>
          </div>
        </template>
      </ImageCard>
    </template>
  </WorkspaceLayout>
</template>

<style scoped>
/* Range Slider Custom Styles Since Tailwind Accent is Limited for deep custom thumbs */
input[type='range'] {
  -webkit-appearance: none;
}
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: var(--primary);
  border-radius: 50%;
  border: 3px solid var(--card);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
input[type='range']:active::-webkit-slider-thumb {
  transform: scale(1.2);
  box-shadow: 0 0 0 6px var(--primary-10); /* primary/10 fallback */
}
</style>
