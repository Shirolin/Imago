<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import {
  Scissors,
  X,
  Loader2,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  RefreshCcw,
  Check,
  Plus,
  Trash2,
  Square,
  CheckSquare
} from 'lucide-vue-next'

const store = useImageStore()
const { fileInput, triggerFileInput, handleFileChange } = useFileHelpers()

const selectedImageId = ref<string | null>(null)
const isProcessing = ref(false)

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

const handleCrop = async () => {
  isProcessing.value = true
  await new Promise((resolve) => setTimeout(resolve, 1000))
  isProcessing.value = false
  alert('裁剪功能逻辑待接入')
}
</script>

<template>
  <WorkspaceLayout show-sidebar>
    <template #header-left>
      <div
        class="flex items-center gap-3.5 cursor-pointer px-4 py-2.5 rounded-2xl bg-muted border border-border transition-all duration-300 hover:border-primary hover:bg-background hover:-translate-y-[1px] active:scale-[0.96]"
        @click="store.toggleAll"
      >
        <div
          class="transition-transform duration-200"
          :class="store.isAllSelected ? 'text-primary' : 'text-muted-foreground'"
        >
          <CheckSquare v-if="store.isAllSelected" :size="20" class="drop-shadow-sm" />
          <Square v-else :size="20" />
        </div>
        <div class="flex flex-col">
          <span class="font-extrabold text-sm text-foreground leading-tight"
            >已选择 {{ store.selectedCount }} / {{ store.images.length }}</span
          >
          <span
            class="text-[0.65rem] text-muted-foreground font-bold uppercase tracking-widest mt-0.5 opacity-80"
            >全选/反选</span
          >
        </div>
      </div>
    </template>

    <template #header-actions>
      <input
        type="file"
        ref="fileInput"
        multiple
        accept="image/*"
        @change="handleFileChange"
        class="hidden"
      />
      <AppButton variant="secondary" size="sm" @click="triggerFileInput" class="!px-3 !h-9">
        <template #icon><Plus :size="16" class="mr-1.5" /></template>
        添加图片
      </AppButton>
      <AppButton
        variant="secondary"
        size="sm"
        :disabled="!store.selectedCount"
        @click="store.removeSelected"
        class="!px-3 !h-9 text-destructive border-transparent hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <template #icon><Trash2 :size="16" class="mr-1.5" /></template>
        删除选中
      </AppButton>
      <AppButton variant="secondary" size="sm" @click="store.clearImages" class="!px-3 !h-9">
        <template #icon><X :size="16" class="mr-1.5" /></template>
        清空全部
      </AppButton>
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
              />
              <div
                class="absolute top-[10%] left-[10%] right-[10%] bottom-[10%] border-2 border-primary z-10"
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
                <div>
                  <div
                    class="absolute w-2.5 h-2.5 bg-white border-2 border-primary -top-1.5 -left-1.5 rounded-[2px] cursor-nwse-resize"
                  ></div>
                  <div
                    class="absolute w-2.5 h-2.5 bg-white border-2 border-primary -top-1.5 -right-1.5 rounded-[2px] cursor-nesw-resize"
                  ></div>
                  <div
                    class="absolute w-2.5 h-2.5 bg-white border-2 border-primary -bottom-1.5 -left-1.5 rounded-[2px] cursor-nesw-resize"
                  ></div>
                  <div
                    class="absolute w-2.5 h-2.5 bg-white border-2 border-primary -bottom-1.5 -right-1.5 rounded-[2px] cursor-nwse-resize"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div
            class="py-4 px-6 border-t border-border bg-card flex items-center gap-6 overflow-x-auto shrink-0"
          >
            <div class="flex flex-col gap-2">
              <span
                class="text-[0.65rem] font-extrabold uppercase text-muted-foreground whitespace-nowrap"
                >纵横比</span
              >
              <div class="flex gap-1.5">
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

            <div class="w-px h-8 bg-border"></div>

            <div class="flex flex-col gap-2">
              <span
                class="text-[0.65rem] font-extrabold uppercase text-muted-foreground whitespace-nowrap"
                >变换</span
              >
              <div class="flex gap-1.5">
                <button
                  class="w-9 h-9 rounded-lg border border-border bg-background text-foreground flex items-center justify-center transition-colors hover:border-primary hover:text-primary active:scale-95"
                  title="向右旋转90°"
                >
                  <RotateCw :size="18" />
                </button>
                <button
                  class="w-9 h-9 rounded-lg border border-border bg-background text-foreground flex items-center justify-center transition-colors hover:border-primary hover:text-primary active:scale-95"
                  title="水平翻转"
                >
                  <FlipHorizontal :size="18" />
                </button>
                <button
                  class="w-9 h-9 rounded-lg border border-border bg-background text-foreground flex items-center justify-center transition-colors hover:border-primary hover:text-primary active:scale-95"
                  title="垂直翻转"
                >
                  <FlipVertical :size="18" />
                </button>
                <button
                  class="w-9 h-9 rounded-lg border border-border bg-background text-foreground flex items-center justify-center transition-colors hover:border-primary hover:text-primary active:scale-95"
                  title="重置修改"
                >
                  <RefreshCcw :size="18" />
                </button>
              </div>
            </div>

            <div class="ml-auto shrink-0 pl-4">
              <AppButton variant="cta" :loading="isProcessing" @click="handleCrop">
                <template #icon><Check v-if="!isProcessing" :size="18" class="mr-2" /></template>
                应用裁剪
              </AppButton>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #sidebar>
      <div class="p-5 border-b border-border bg-card">
        <h2 class="text-[0.9rem] font-bold text-foreground">待处理队列</h2>
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
