<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import {
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  RefreshCcw,
  Check,
  X,
  Square,
  CheckSquare,
  ListOrdered
} from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import { cropEngine } from '../lib/engines/cropEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

const store = useImageStore()

const selectedImageId = ref<string | null>(null)
const rotation = ref(0)
const flipH = ref(false)
const flipV = ref(false)

const { isProcessing, processSingle } = useImageProcessor(cropEngine)

const selectedImage = computed(() => {
  return store.images.find((img) => img.id === selectedImageId.value) || store.images[0]
})

const aspectRatios = [
  { label: '自由', value: 'free' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '16:9', value: '16:9' },
  { label: '2:3', value: '2:3' }
]
const currentRatio = ref('free')

const handleRotate = () => {
  rotation.value = (rotation.value + 90) % 360
}

const handleFlipH = () => {
  flipH.value = !flipH.value
}

const handleFlipV = () => {
  flipV.value = !flipV.value
}

const handleReset = () => {
  rotation.value = 0
  flipH.value = false
  flipV.value = false
  currentRatio.value = 'free'
}

const handleCrop = () => {
  if (!selectedImage.value) return
  processSingle(selectedImage.value.id, {
    rotation: rotation.value,
    flipH: flipH.value,
    flipV: flipV.value
  })
}

const previewStyle = computed(() => ({
  transform: `rotate(${rotation.value}deg) scale(${flipH.value ? -1 : 1}, ${flipV.value ? -1 : 1})`,
  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
}))
</script>

<template>
  <WorkspaceLayout show-sidebar>
    <template #header-left>
      <ImageSelectionStatus />
    </template>

    <template #header-actions>
      <ImageActionsToolbar show-clear-all />
    </template>

    <template #content>
      <div class="col-span-full h-full flex flex-col">
        <div
          class="flex-1 flex flex-col bg-card border border-border rounded-[20px] overflow-hidden"
        >
          <div
            class="flex-1 bg-background m-4 rounded-xl border border-border flex items-center justify-center relative overflow-hidden"
            style="
              background-image: radial-gradient(var(--border) 1px, transparent 1px);
              background-size: 20px 20px;
            "
          >
            <div
              v-if="selectedImage"
              class="relative max-w-[90%] max-h-[90%] flex items-center justify-center"
            >
              <img
                :src="selectedImage.preview"
                alt="Crop Preview"
                class="max-w-full max-h-full shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
                :style="previewStyle"
              />
              <div
                class="absolute top-[10%] left-[10%] right-[10%] bottom-[10%] border-2 border-primary z-10 pointer-events-none"
              >
                <div
                  class="absolute inset-0"
                  style="
                    background-image:
                      linear-gradient(to right, rgba(255, 255, 255, 0.2) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(255, 255, 255, 0.2) 1px, transparent 1px);
                    background-size: 33.33% 33.33%;
                  "
                ></div>
                <!-- 这里的操作手柄可以根据需要添加 pointer-events -->
              </div>
            </div>
          </div>

          <div
            class="p-4 md:py-4 md:px-6 border-t border-border bg-card flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-6 overflow-x-auto shrink-0"
          >
            <div class="flex flex-col gap-2 shrink-0">
              <span
                class="text-[0.65rem] font-extrabold uppercase text-muted-foreground whitespace-nowrap"
                >纵横比</span
              >
              <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mb-1">
                <button
                  v-for="ratio in aspectRatios"
                  :key="ratio.value"
                  class="py-1.5 px-3 rounded-lg border text-sm font-semibold transition-colors duration-200 whitespace-nowrap"
                  :class="
                    currentRatio === ratio.value
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                      : 'bg-background border-border text-foreground hover:border-primary/50 hover:-translate-y-[1px]'
                  "
                  @click="currentRatio = ratio.value"
                >
                  {{ ratio.label }}
                </button>
              </div>
            </div>

            <div class="hidden md:block w-px h-8 bg-border"></div>

            <div class="flex flex-col gap-2 shrink-0">
              <span
                class="text-[0.65rem] font-extrabold uppercase text-muted-foreground whitespace-nowrap"
                >变换</span
              >
              <div class="flex gap-1.5">
                <button
                  class="w-9 h-9 rounded-lg border border-border bg-background text-foreground flex items-center justify-center transition-colors hover:border-primary hover:text-primary active:scale-95"
                  @click="handleRotate"
                  title="向右旋转90°"
                >
                  <RotateCw :size="18" />
                </button>
                <button
                  class="w-9 h-9 rounded-lg border border-border bg-background text-foreground flex items-center justify-center transition-colors hover:border-primary hover:text-primary active:scale-95"
                  @click="handleFlipH"
                  :class="{ 'bg-primary/10 border-primary text-primary': flipH }"
                  title="水平翻转"
                >
                  <FlipHorizontal :size="18" />
                </button>
                <button
                  class="w-9 h-9 rounded-lg border border-border bg-background text-foreground flex items-center justify-center transition-colors hover:border-primary hover:text-primary active:scale-95"
                  @click="handleFlipV"
                  :class="{ 'bg-primary/10 border-primary text-primary': flipV }"
                  title="垂直翻转"
                >
                  <FlipVertical :size="18" />
                </button>
                <button
                  class="w-9 h-9 rounded-lg border border-border bg-background text-foreground flex items-center justify-center transition-colors hover:border-primary hover:text-primary active:scale-95"
                  @click="handleReset"
                  title="重置修改"
                >
                  <RefreshCcw :size="18" />
                </button>
              </div>
            </div>

            <div class="md:ml-auto w-full md:w-auto shrink-0 flex">
              <AppButton
                variant="cta"
                class="w-full md:w-auto"
                :loading="isProcessing"
                @click="handleCrop"
              >
                <template #icon><Check v-if="!isProcessing" :size="16" class="mr-2" /></template>
                应用裁剪/变换
              </AppButton>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #sidebar>
      <div class="p-5 border-b border-border bg-card">
        <AppSectionHeader title="待处理队列" :icon="ListOrdered" />
      </div>
      <div class="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 custom-scrollbar bg-card/50">
        <div
          v-for="img in store.images"
          :key="img.id"
          class="flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border-2 transition-colors duration-200 group"
          :class="{
            'bg-green-500/5 border-primary shadow-sm': selectedImage?.id === img.id,
            'border-transparent hover:bg-muted': selectedImage?.id !== img.id
          }"
          @click="selectedImageId = img.id"
        >
          <div
            class="text-muted-foreground flex shrink-0"
            @click.stop="store.toggleSelection(img.id)"
          >
            <CheckSquare
              v-if="store.selectedIds.has(img.id)"
              :size="16"
              class="text-primary drop-shadow-sm"
            />
            <Square v-else :size="16" />
          </div>
          <div
            class="w-10 h-10 rounded-lg bg-background overflow-hidden shrink-0 border border-border/50"
          >
            <img :src="img.preview" alt="" class="w-full h-full object-cover" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[0.8rem] font-semibold text-foreground truncate">{{ img.file.name }}</p>
          </div>
          <button
            @click.stop="store.removeImage(img.id)"
            class="w-5 h-5 rounded border-none bg-transparent text-muted-foreground flex items-center justify-center cursor-pointer opacity-0 transition-opacity hover:bg-destructive hover:text-white group-hover:opacity-100"
          >
            <X :size="14" />
          </button>
        </div>

        <div
          v-if="store.images.length === 0"
          class="flex items-center justify-center h-full text-muted-foreground text-sm font-medium py-10"
        >
          暂无图片
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>
