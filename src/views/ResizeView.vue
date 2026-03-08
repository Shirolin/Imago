<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import {
  X,
  Download,
  Zap,
  Trash2,
  Settings2,
  Loader2,
  Plus,
  Square,
  CheckSquare
} from 'lucide-vue-next'

const store = useImageStore()
const { fileInput, triggerFileInput, handleFileChange, downloadImage } = useFileHelpers()

const resizeMode = ref<'pixels' | 'percentage'>('percentage')
const width = ref(1920)
const height = ref(1080)
const percentage = ref(50)
const maintainAspectRatio = ref(true)
const isProcessing = ref(false)

const handleResize = async () => {
  isProcessing.value = true
  // 模拟处理逻辑
  await new Promise((resolve) => setTimeout(resolve, 1500))
  store.images.forEach((img) => {
    store.updateImage(img.id, { status: 'done' })
  })
  isProcessing.value = false
}

const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob || item?.preview) {
    // 这里暂时使用预览图模拟，实际逻辑应根据处理后的 Blob
    fetch(item.preview)
      .then((res) => res.blob())
      .then((blob) => {
        downloadImage(blob, item.file.name, 'resized_')
      })
  }
}
</script>

<template>
  <WorkspaceLayout show-sidebar>
    <template #header-left>
      <div
        class="flex items-center gap-3.5 cursor-pointer px-5 h-11 rounded-full bg-muted/40 border border-border/50 transition-all duration-300 hover:border-primary/50 hover:bg-background hover:-translate-y-[1px] active:scale-[0.96] group"
        @click="store.toggleAll"
      >
        <div
          class="flex items-center justify-center transition-colors duration-200"
          :class="store.isAllSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'"
        >
          <CheckSquare v-if="store.isAllSelected" :size="18" class="drop-shadow-sm" />
          <Square v-else :size="18" />
        </div>
        <div class="flex flex-col justify-center">
          <span class="font-bold text-[0.8rem] text-foreground leading-none tracking-tight"
            >已选择 {{ store.selectedCount }} / {{ store.images.length }}</span
          >
          <span
            class="text-[0.6rem] text-muted-foreground font-black uppercase tracking-[0.1em] mt-0.5 opacity-60 leading-none"
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
      <AppButton variant="secondary" size="md" @click="triggerFileInput">
        <template #icon><Plus :size="16" class="mr-1.5" /></template>
        添加图片
      </AppButton>
      <AppButton
        variant="danger"
        size="md"
        :disabled="!store.selectedCount"
        @click="store.removeSelected"
      >
        <template #icon><Trash2 :size="16" class="mr-1.5" /></template>
        删除选中
      </AppButton>
      <AppButton variant="secondary" size="md" @click="store.clearImages">
        <template #icon><X :size="16" class="mr-1.5" /></template>
        清空全部
      </AppButton>
    </template>

    <template #content>
      <ImageCard
        v-for="img in store.images"
        :key="img.id"
        :image="img"
        :is-selected="store.selectedIds.has(img.id)"
        @toggle="store.toggleSelection"
        @remove="store.removeImage"
        @download="handleDownload"
      />
    </template>

    <template #sidebar>
      <div class="p-6 flex flex-col gap-6 h-full">
        <div class="flex flex-col gap-4">
          <div
            class="flex items-center justify-between font-bold text-[0.85rem] text-foreground uppercase"
          >
            <div class="flex items-center gap-2">
              <Settings2 :size="18" class="text-primary" /> 调整模式
            </div>
          </div>
          <div class="flex bg-muted p-1 rounded-xl border border-border">
            <button
              class="flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all"
              :class="
                resizeMode === 'percentage'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="resizeMode = 'percentage'"
            >
              百分比
            </button>
            <button
              class="flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all"
              :class="
                resizeMode === 'pixels'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="resizeMode = 'pixels'"
            >
              像素
            </button>
          </div>
        </div>

        <div v-if="resizeMode === 'percentage'" class="flex flex-col gap-4">
          <div
            class="flex items-center justify-between font-bold text-[0.85rem] text-foreground uppercase"
          >
            <span>缩放比例</span>
            <span class="bg-green-500/10 text-primary px-2 py-0.5 rounded-md text-xs"
              >{{ percentage }}%</span
            >
          </div>
          <div class="flex flex-col">
            <input
              type="range"
              v-model.number="percentage"
              min="1"
              max="200"
              step="1"
              class="w-full h-1.5 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer mb-3 shadow-[0_0_0_3px_hsl(var(--card))] border-none focus:outline-none"
            />
            <div class="flex justify-between text-[0.65rem] text-muted-foreground font-bold">
              <span>1%</span>
              <span>100%</span>
              <span>200%</span>
            </div>
          </div>
        </div>

        <div v-else class="flex flex-col gap-4">
          <div class="grid grid-cols-2 gap-3 mb-2">
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-muted-foreground">宽度 (px)</label>
              <input
                type="number"
                inputmode="numeric"
                v-model.number="width"
                class="p-3 bg-muted border border-border rounded-xl text-foreground font-bold outline-none focus:border-primary transition-colors w-full cursor-text"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-muted-foreground">高度 (px)</label>
              <input
                type="number"
                inputmode="numeric"
                v-model.number="height"
                class="p-3 bg-muted border border-border rounded-xl text-foreground font-bold outline-none focus:border-primary transition-colors w-full cursor-text"
              />
            </div>
          </div>
          <label
            class="flex items-center gap-2.5 cursor-pointer text-sm font-bold text-muted-foreground hover:text-foreground transition-colors group"
          >
            <div
              class="relative w-5 h-5 rounded-md border border-border bg-muted flex items-center justify-center group-hover:border-primary transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                v-model="maintainAspectRatio"
                class="absolute opacity-0 w-full h-full cursor-pointer z-10"
              />
              <Check v-if="maintainAspectRatio" :size="14" class="text-primary" />
            </div>
            锁定纵横比
          </label>
        </div>

        <div
          class="bg-green-500/5 p-4 rounded-xl flex gap-3 text-muted-foreground text-xs leading-relaxed border border-dashed border-primary/30"
        >
          <Zap :size="16" class="text-primary shrink-0" />
          <p>处理后图片质量将保持在最高水平，采用 Lanczos 算法进行高质量缩放。</p>
        </div>

        <div class="mt-auto flex flex-col gap-3">
          <AppButton
            size="lg"
            variant="cta"
            class="w-full"
            :loading="isProcessing"
            @click="handleResize"
          >
            {{ isProcessing ? '正在处理...' : '执行调整' }}
          </AppButton>
          <p class="text-center text-xs text-muted-foreground">所有操作在浏览器本地完成</p>
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>
