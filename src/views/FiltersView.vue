<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import ImageCard from '../components/common/ImageCard.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import { Settings2, Sparkles, Check } from 'lucide-vue-next'
import { filterEngine } from '../lib/engines/filterEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadImage } = useFileHelpers()

// 状态
const brightness = ref(100)
const contrast = ref(100)
const saturation = ref(100)
const blur = ref(0)
const sepia = ref(0)
const outputFormat = ref<string>('original')
const outputQuality = ref(0.9)
const isDirty = ref(false)

const { isProcessing, processSelected } = useImageProcessor(filterEngine)

const displayImages = computed(() => [...store.images].reverse())

const handleApplyFilters = async () => {
  await processSelected({
    brightness: brightness.value,
    contrast: contrast.value,
    saturation: saturation.value,
    blur: blur.value,
    sepia: sepia.value,
    grayscale: 0,
    hueRotate: 0,
    invert: 0,
    vignette: 0,
    sharpen: 0,
    noise: 0,
    format: outputFormat.value,
    quality: outputQuality.value
  })
  isDirty.value = false
}

const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) downloadImage(item.processedBlob, item.file.name, '_Filtered')
}

watch(
  [brightness, contrast, saturation, blur, sepia, outputFormat, outputQuality],
  () => {
    isDirty.value = true
    store.markAllAsDirty()
  },
  { deep: true }
)

const buttonText = computed(() => {
  if (isProcessing.value) return '正在应用...'
  if (store.selectedCount > 0) return `对选中的 ${store.selectedCount} 张应用效果`
  return '应用滤镜效果'
})
</script>

<template>
  <div class="h-full w-full flex flex-col overflow-hidden">
    <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
      <template #header-left><ImageSelectionStatus /></template>
      <template #header-actions
        ><ImageActionsToolbar :is-processing="isProcessing" show-clear-all zip-prefix="_Filtered"
      /></template>

      <template #content>
        <div class="h-full w-full overflow-y-auto custom-scrollbar p-4 md:p-6">
          <div
            class="grid transition-all duration-300"
            :class="[
              layoutStore.cardSizeMode === 'compact'
                ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 md:gap-8'
                : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 md:gap-10'
            ]"
          >
            <ImageCard
              v-for="img in displayImages"
              :key="img.id"
              :image="img"
              :is-selected="store.selectedIds.has(img.id)"
              @toggle="store.toggleSelection"
              @remove="store.removeImage"
              @download="handleDownload"
            />
          </div>
        </div>
      </template>

      <template #sidebar>
        <section class="space-y-5">
          <AppSectionHeader title="调整参数" :icon="Settings2" />
          <div class="space-y-6 px-1">
            <AppSlider v-model="brightness" label="亮度" :min="0" :max="200" :step="1" unit="%" />
            <AppSlider v-model="contrast" label="对比度" :min="0" :max="200" :step="1" unit="%" />
            <AppSlider v-model="saturation" label="饱和度" :min="0" :max="200" :step="1" unit="%" />
            <AppSlider v-model="blur" label="模糊" :min="0" :max="20" :step="1" unit="px" />
            <AppSlider v-model="sepia" label="褐色" :min="0" :max="100" :step="1" unit="%" />
          </div>
        </section>

        <section class="pt-4">
          <div
            class="p-4 bg-primary/[0.03] border border-dashed border-primary/20 rounded-2xl flex gap-3"
          >
            <Sparkles :size="16" class="text-primary shrink-0 mt-0.5" />
            <p class="text-[0.65rem] text-muted-foreground leading-relaxed">
              实时预览滤镜效果，所有处理均在浏览器本地完成。
            </p>
          </div>
        </section>

        <AppExportSettings
          v-model:format="outputFormat"
          v-model:quality="outputQuality"
          class="pt-2"
        />
      </template>

      <template #footer>
        <InspectorFooter>
          <AppButton
            size="lg"
            variant="cta"
            class="w-full h-12 rounded-xl shadow-xl shadow-primary/10 transition-all active:scale-95"
            :loading="isProcessing"
            :disabled="!store.selectedCount || isProcessing"
            @click="handleApplyFilters"
          >
            <template #icon><Check v-if="!isProcessing" :size="18" class="mr-2" /></template>
            <span class="font-bold text-sm tracking-tight">{{ buttonText }}</span>
          </AppButton>
        </InspectorFooter>
      </template>
    </WorkspaceLayout>
  </div>
</template>
