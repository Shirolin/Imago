<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import {
  Layers,
  Settings2,
  ArrowDown,
  ArrowRight,
  Grid3X3,
  MoveLeft,
  MoveRight
} from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppTip from '../components/common/AppTip.vue'
import { combineEngine } from '../lib/engines/combineEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useFileHelpers } from '../composables/useFileHelpers'

const store = useImageStore()
const { downloadImage } = useFileHelpers()

const combineDirection = ref<'vertical' | 'horizontal' | 'grid'>('vertical')
const spacing = ref(10)
const backgroundColor = ref('#FFFFFF')

const { isProcessing, processCombine } = useImageProcessor(combineEngine)

const combineDirections = [
  { label: '纵向', value: 'vertical', icon: ArrowDown },
  { label: '横向', value: 'horizontal', icon: ArrowRight },
  { label: '网格', value: 'grid', icon: Grid3X3 }
]

const handleCombine = async () => {
  if (store.images.length < 2) {
    alert('请至少上传两张图片')
    return
  }

  try {
    const result = await processCombine({
      direction: combineDirection.value,
      spacing: spacing.value,
      backgroundColor: backgroundColor.value
    })

    if (result && result.blob) {
      downloadImage(result.blob, 'combined_image.png')
      // 标记所有图片为完成状态以更新 UI 进度条（可选）
      store.images.forEach((img) => store.updateImage(img.id, { status: 'done' }))
    }
  } catch (error) {
    console.error('Combine failed:', error)
  }
}

const moveImage = (index: number, direction: 'prev' | 'next') => {
  const newImages = [...store.images]
  const targetIndex = direction === 'prev' ? index - 1 : index + 1
  if (targetIndex >= 0 && targetIndex < newImages.length) {
    const temp = newImages[index]!
    newImages[index] = newImages[targetIndex]!
    newImages[targetIndex] = temp
    store.images = newImages
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
        v-for="(img, index) in store.images"
        :key="img.id"
        :image="img"
        :is-selected="store.selectedIds.has(img.id)"
        @toggle="store.toggleSelection"
        @remove="store.removeImage"
      >
        <template #meta>
          <div class="flex gap-1.5 mt-2">
            <button
              @click.stop="moveImage(index, 'prev')"
              :disabled="index === 0"
              class="flex-1 h-6 rounded border border-border bg-muted flex items-center justify-center cursor-pointer transition-colors text-foreground hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-foreground"
            >
              <MoveLeft :size="14" />
            </button>
            <button
              @click.stop="moveImage(index, 'next')"
              :disabled="index === store.images.length - 1"
              class="flex-1 h-6 rounded border border-border bg-muted flex items-center justify-center cursor-pointer transition-colors text-foreground hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-foreground"
            >
              <MoveRight :size="14" />
            </button>
          </div>
        </template>
      </ImageCard>
    </template>

    <template #sidebar>
      <div class="p-6 flex flex-col gap-6 h-full">
        <div class="flex flex-col gap-4">
          <AppSectionHeader title="布局方向" :icon="Settings2" />
          <AppSegmentedControl v-model="combineDirection" :options="combineDirections" />
        </div>

        <AppSlider v-model="spacing" label="间距" unit="px" />

        <div class="flex flex-col gap-4">
          <div
            class="flex items-center justify-between font-bold text-[0.85rem] text-foreground uppercase"
          >
            <span>背景颜色</span>
          </div>
          <div class="flex gap-2">
            <input
              type="color"
              v-model="backgroundColor"
              class="w-9 h-9 border border-border rounded-lg bg-transparent cursor-pointer p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none appearance-none"
            />
            <input
              type="text"
              v-model="backgroundColor"
              class="flex-1 px-3 bg-muted border border-border rounded-lg text-foreground font-mono text-xs outline-none focus:border-primary transition-colors"
              placeholder="#FFFFFF"
            />
          </div>
        </div>

        <div class="mt-auto flex flex-col gap-3">
          <AppButton size="lg" variant="cta" :loading="isProcessing" @click="handleCombine">
            <template #icon><Layers v-if="!isProcessing" :size="20" class="mr-2" /></template>
            执行合并
          </AppButton>
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>
