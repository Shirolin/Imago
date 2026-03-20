<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useElementSize, watchOnce, useResizeObserver } from '@vueuse/core'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import AppCanvasWorkspace from '../components/common/AppCanvasWorkspace.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import {
  Layers,
  Settings2,
  ArrowDown,
  ArrowRight,
  Grid3X3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  X,
  Plus
} from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSlider from '../components/common/AppSlider.vue'
import { combineEngine } from '../lib/engines/combineEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useFileHelpers } from '../composables/useFileHelpers'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const { downloadImage, triggerFileInput } = useFileHelpers()

// 视口引擎
const workspaceRef = ref<InstanceType<typeof AppCanvasWorkspace> | null>(null)
const containerRef = computed(() => workspaceRef.value?.containerRef)
const contentRef = ref<HTMLDivElement | null>(null)

const { width: contentWidth, height: contentHeight } = useElementSize(contentRef)

const resetView = () => {
  if (!contentWidth.value || !contentHeight.value) return
  workspaceRef.value?.triggerAutoFit(contentWidth.value, contentHeight.value, 100)
}

useResizeObserver(containerRef, resetView)
useResizeObserver(contentRef, resetView)

watchOnce([() => store.images.length, containerRef], () => setTimeout(resetView, 100))

// 配置状态
const combineDirection = ref<'vertical' | 'horizontal' | 'grid'>('vertical')
const alignment = ref<'start' | 'center' | 'end'>('center')
const spacing = ref(0)
const columns = ref(3)
const padding = ref(0)
const borderRadius = ref(0)
const backgroundColor = ref('#00000000')
const outputFormat = ref<string>('image/png')
const outputQuality = ref(0.9)

const combineDirections = [
  { label: '纵向', value: 'vertical', icon: ArrowDown },
  { label: '横向', value: 'horizontal', icon: ArrowRight },
  { label: '网格', value: 'grid', icon: Grid3X3 }
]
const alignmentOptions = computed(() => {
  if (combineDirection.value === 'vertical')
    return [
      { label: '左对齐', value: 'start', icon: AlignLeft },
      { label: '居中', value: 'center', icon: AlignCenter },
      { label: '右对齐', value: 'end', icon: AlignRight }
    ]
  if (combineDirection.value === 'horizontal')
    return [
      { label: '顶对齐', value: 'start', icon: AlignStartVertical },
      { label: '居中', value: 'center', icon: AlignCenterVertical },
      { label: '底对齐', value: 'end', icon: AlignEndVertical }
    ]
  return [
    { label: '起点', value: 'start', icon: AlignLeft },
    { label: '居中', value: 'center', icon: AlignCenter },
    { label: '终点', value: 'end', icon: AlignRight }
  ]
})

const { isProcessing, processCombine } = useImageProcessor(combineEngine)

const handleCombine = async () => {
  if (store.images.length < 2) return
  try {
    const result = await processCombine({
      direction: combineDirection.value,
      spacing: spacing.value,
      columns: columns.value,
      padding: padding.value,
      borderRadius: borderRadius.value,
      backgroundColor:
        backgroundColor.value === '#00000000' ? 'transparent' : backgroundColor.value,
      alignment: alignment.value,
      format: outputFormat.value,
      quality: outputQuality.value
    })
    if (result?.blob) downloadImage(result.blob, `combined_${Date.now()}`)
  } catch (error) {
    console.error('Combine failed:', error)
  }
}

const dragIndex = ref<number | null>(null)
const dropTargetIndex = ref<number | null>(null)
const onDragOver = (e: DragEvent, index: number) => {
  e.preventDefault()
  dropTargetIndex.value = index
}
const onDrop = (index: number) => {
  if (dragIndex.value !== null && dragIndex.value !== index) {
    const newImages = [...store.images]
    const [removed] = newImages.splice(dragIndex.value, 1)
    newImages.splice(index, 0, removed!)
    store.images = newImages
  }
  dragIndex.value = null
  dropTargetIndex.value = null
}

const previewListStyles = computed(() => ({
  display: combineDirection.value === 'grid' ? 'grid' : 'inline-flex',
  gridTemplateColumns:
    combineDirection.value === 'grid' ? `repeat(${columns.value}, max-content)` : 'none',
  gap: `${spacing.value}px`,
  backgroundColor: backgroundColor.value === '#00000000' ? 'transparent' : backgroundColor.value,
  flexDirection: (combineDirection.value === 'vertical' ? 'column' : 'row') as 'column' | 'row',
  alignItems:
    alignment.value === 'start' ? 'flex-start' : alignment.value === 'end' ? 'flex-end' : 'center',
  justifyContent: 'center',
  padding: `${padding.value}px`,
  minWidth: '100px',
  minHeight: '100px'
}))

const hasEnoughImages = computed(() => store.images.length >= 2)
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
    <template #header-left><ImageSelectionStatus /></template>
    <template #header-actions
      ><ImageActionsToolbar :is-processing="isProcessing" show-clear-all
    /></template>

    <template #content>
      <AppCanvasWorkspace ref="workspaceRef" transform-duration="duration-200" @reset="resetView">
        <template #default>
          <div
            v-if="store.images.length > 0"
            ref="contentRef"
            class="relative shadow-2xl transition-shadow"
            :style="previewListStyles"
          >
            <div
              v-for="(img, index) in store.images"
              :key="img.id"
              class="relative group/item focus:outline-none focus:ring-2 focus:ring-primary rounded-sm"
              :class="{
                'opacity-30 grayscale scale-95': dragIndex === index,
                'ring-2 ring-primary ring-offset-4':
                  dropTargetIndex === index && dragIndex !== index
              }"
              draggable="true"
              @dragstart="dragIndex = index"
              @dragover="onDragOver($event, index)"
              @drop="onDrop(index)"
              @dragend="dragIndex = null"
            >
              <div
                class="relative overflow-hidden bg-background shadow-lg"
                :style="{ borderRadius: `${borderRadius}px` }"
              >
                <img
                  :src="img.preview"
                  class="block max-w-[240px] md:max-w-[400px] h-auto pointer-events-none"
                />
                <div
                  class="absolute inset-0 bg-black/20 opacity-0 group-hover/item:opacity-100 transition-all flex flex-col justify-between p-2 pointer-events-none"
                >
                  <button
                    @click.stop="store.removeImage(img.id)"
                    class="self-end p-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-all pointer-events-auto active:scale-90"
                  >
                    <X :size="12" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="!hasEnoughImages"
            class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none"
          >
            <div
              class="w-20 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 ring-8 ring-primary/5"
            >
              <Layers :size="32" class="text-primary animate-pulse" />
            </div>
            <AppButton
              variant="cta"
              size="md"
              class="rounded-full px-8 pointer-events-auto"
              @click="triggerFileInput"
              ><Plus :size="18" class="mr-1.5" />立即添加图片</AppButton
            >
          </div>
        </template>
      </AppCanvasWorkspace>
    </template>

    <template #sidebar>
      <section class="space-y-5">
        <AppSectionHeader title="拼接模式" :icon="Settings2" /><AppSegmentedControl
          v-model="combineDirection"
          :options="combineDirections"
        />
      </section>
      <section class="space-y-5">
        <AppSectionHeader title="对齐方式" :icon="AlignCenter" /><AppSegmentedControl
          v-model="alignment"
          :options="alignmentOptions"
        />
      </section>
      <div class="space-y-6 px-1">
        <AppSlider
          v-if="combineDirection === 'grid'"
          v-model="columns"
          label="网格列数"
          :min="1"
          :max="10"
          unit="列"
        />
        <AppSlider v-model="spacing" label="图片间距" :min="0" :max="200" unit="px" />
        <AppSlider v-model="padding" label="外边距" :min="0" :max="200" unit="px" />
        <AppSlider v-model="borderRadius" label="图片圆角" :min="0" :max="100" unit="px" />
        <AppExportSettings
          v-model:format="outputFormat"
          v-model:quality="outputQuality"
          class="pt-4"
        />
      </div>
    </template>

    <template #footer>
      <InspectorFooter>
        <AppButton
          size="lg"
          variant="cta"
          class="w-full h-12 rounded-xl shadow-xl shadow-primary/10 active:scale-95 transition-all"
          :loading="isProcessing"
          :disabled="!hasEnoughImages"
          @click="handleCombine"
        >
          <template #icon><Layers v-if="!isProcessing" :size="19" class="mr-2" /></template>
          <span class="font-bold text-sm tracking-tight">{{
            isProcessing ? '正在拼合...' : '生成并下载'
          }}</span>
        </AppButton>
      </InspectorFooter>
    </template>
  </WorkspaceLayout>
</template>

<style scoped></style>
