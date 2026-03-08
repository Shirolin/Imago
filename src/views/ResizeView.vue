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
import { resizeEngine } from '../lib/engines/resizeEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

const store = useImageStore()
const { downloadImage } = useFileHelpers()

const resizeMode = ref<'pixels' | 'percentage'>('percentage')
const width = ref(1920)
const height = ref(1080)
const percentage = ref(50)
const maintainAspectRatio = ref(true)

const { isProcessing, processAll } = useImageProcessor(resizeEngine)

const resizeModes = [
  { label: '百分比', value: 'percentage' },
  { label: '像素', value: 'pixels' }
]

const handleResize = () => {
  processAll({
    mode: resizeMode.value,
    width: width.value,
    height: height.value,
    percentage: percentage.value,
    maintainAspectRatio: maintainAspectRatio.value
  })
}

const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) {
    downloadImage(item.processedBlob, item.file.name, 'resized_')
  }
}
</script>

<template>
  <WorkspaceLayout show-sidebar>
    <template #header-left>
      <ImageSelectionStatus />
    </template>

    <template #header-actions>
      <ImageActionsToolbar show-clear-all zip-prefix="Resize" />
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

        <AppTip> 采用 Lanczos 算法进行高质量缩放，最大程度保留图片细节与边缘锐度。 </AppTip>

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
