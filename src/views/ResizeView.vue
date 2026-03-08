<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import { Zap, Settings2, Check } from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppTip from '../components/common/AppTip.vue'

const store = useImageStore()
const { downloadImage } = useFileHelpers()

const resizeMode = ref<'pixels' | 'percentage'>('percentage')
const width = ref(1920)
const height = ref(1080)
const percentage = ref(50)
const maintainAspectRatio = ref(true)
const isProcessing = ref(false)

const resizeModes = [
  { label: '百分比', value: 'percentage' },
  { label: '像素', value: 'pixels' }
]

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
      <ImageSelectionStatus />
    </template>

    <template #header-actions>
      <ImageActionsToolbar show-clear-all />
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
          <AppSectionHeader title="调整模式" :icon="Settings2" />
          <AppSegmentedControl v-model="resizeMode" :options="resizeModes" />
        </div>

        <div v-if="resizeMode === 'percentage'" class="flex flex-col gap-4">
          <AppSlider v-model="percentage" label="缩放比例" :min="1" :max="200" unit="%" />
          <div class="flex justify-between text-[0.65rem] text-muted-foreground font-bold px-1">
            <span>1%</span>
            <span>100%</span>
            <span>200%</span>
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

        <AppTip :icon="Zap">
          处理后图片质量将保持在最高水平，采用 Lanczos 算法进行高质量缩放。
        </AppTip>

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
