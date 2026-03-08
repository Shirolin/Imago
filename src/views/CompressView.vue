<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import imageCompression from 'browser-image-compression'
import { Zap, ArrowRight } from 'lucide-vue-next'
import AppSlider from '../components/common/AppSlider.vue'

const store = useImageStore()
const { formatSize, downloadImage } = useFileHelpers()

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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorName = error instanceof Error ? error.name : ''

    if (errorName === 'AbortError' || errorMessage.includes('abort')) {
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
      <div class="flex items-center gap-4 md:gap-7 h-11">
        <ImageSelectionStatus />

        <div class="hidden md:block w-px h-6 bg-border/60"></div>

        <!-- 质量调节区 -->
        <div class="flex flex-col gap-1.5 md:gap-2 min-w-[120px] md:min-w-[180px] justify-center">
          <AppSlider
            v-model="compressionQuality"
            label="压缩质量"
            :min="0.1"
            :max="1.0"
            :step="0.05"
            :unit="''"
          >
            <template #default="{ modelValue }">
              <span class="text-primary bg-primary/10 px-1.5 py-0.5 rounded leading-none"
                >{{ Math.round(modelValue * 100) }}%</span
              >
            </template>
          </AppSlider>
        </div>
      </div>
    </template>

    <!-- 核心操作传送至顶栏 -->
    <Teleport to="#top-bar-tools">
      <ImageActionsToolbar :is-processing="isCompressing">
        <template #extra>
          <div class="w-px h-5 md:h-6 bg-border mx-1 md:mx-2"></div>

          <AppButton
            variant="cta"
            size="md"
            :loading="isCompressing"
            :disabled="!store.images.length"
            @click="compressAll"
          >
            <template #icon>
              <Zap v-if="!isCompressing" :size="16" class="mr-1.5" />
            </template>
            处理全部
          </AppButton>
        </template>
      </ImageActionsToolbar>
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
