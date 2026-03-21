<script setup lang="ts">
import { ref, computed, watch, nextTick, h } from 'vue'
import { useImageStore } from '../stores/imageStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import CropBox from '../components/common/CropBox.vue'
import AppCanvasWorkspace from '../components/common/AppCanvasWorkspace.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import {
  Scissors,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Grid3X3,
  Square,
  RotateCcw,
  Undo2,
  Redo2,
  Settings2,
  LayoutGrid,
  Link as LinkIcon,
  Unlink
} from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppInput from '../components/common/AppInput.vue'
import { cropEngine } from '../lib/engines/cropEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useResizeObserver } from '@vueuse/core'
import { useHistory } from '../composables/useHistory'
import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()

const createRatioIcon = (width: number, height: number) => {
  return () =>
    h(
      'svg',
      {
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        style: { width: '100%', height: '100%' }
      },
      [h('rect', { x: (24 - width) / 2, y: (24 - height) / 2, width, height, rx: '1.5' })]
    )
}
const Icon43 = createRatioIcon(18, 14)
const Icon169 = createRatioIcon(20, 11)
const Icon23 = createRatioIcon(13, 19)

// --- 状态 ---
const rotation = ref(0)
const flipH = ref(false)
const flipV = ref(false)
const currentRatio = ref<number>(0)
const outputQuality = ref(0.92)
const outputFormat = ref<string>('original')
const preserveExif = ref(false)
const customFillColor = ref('#ffffff')
const isTransparent = ref(true)
const internalCrop = ref({ x: 0, y: 0, w: 100, h: 100 })
const gridMode = ref<'none' | 'thirds' | 'golden' | 'cross'>('thirds')
const trimPx = ref({ top: 0, bottom: 0, left: 0, right: 0 })

const allSettings = computed({
  get: () => ({
    rotation: rotation.value,
    flipH: flipH.value,
    flipV: flipV.value,
    currentRatio: currentRatio.value,
    outputQuality: outputQuality.value,
    outputFormat: outputFormat.value,
    preserveExif: preserveExif.value,
    customFillColor: customFillColor.value,
    isTransparent: isTransparent.value,
    internalCrop: { ...internalCrop.value },
    gridMode: gridMode.value,
    trimPx: { ...trimPx.value }
  }),
  set: (v) => {
    rotation.value = v.rotation
    flipH.value = v.flipH
    flipV.value = v.flipV
    currentRatio.value = v.currentRatio
    outputQuality.value = v.outputQuality
    outputFormat.value = v.outputFormat
    preserveExif.value = v.preserveExif
    customFillColor.value = v.customFillColor
    isTransparent.value = v.isTransparent
    internalCrop.value = { ...v.internalCrop }
    gridMode.value = v.gridMode
    trimPx.value = { ...v.trimPx }
  }
})

const { canUndo, canRedo, undo, redo, commit, clear: clearHistory } = useHistory(allSettings)
const recordBeforeAction = () => commit()

const handleRotate = () => {
  recordBeforeAction()
  rotation.value = (rotation.value + 90) % 360
}
const handleFlipH = () => {
  recordBeforeAction()
  flipH.value = !flipH.value
}
const handleFlipV = () => {
  recordBeforeAction()
  flipV.value = !flipV.value
}
const handleRatioChange = (val: any) => {
  recordBeforeAction()
  currentRatio.value = val
}

const setFillColor = (color: string | 'transparent') => {
  recordBeforeAction()
  if (color === 'transparent') {
    isTransparent.value = true
  } else {
    isTransparent.value = false
    customFillColor.value = color
  }
}

const finalFillColor = computed(() => (isTransparent.value ? 'transparent' : customFillColor.value))
const isDragging = ref(false)
const isSnapping = ref(false)

const { isProcessing, processSingle } = useImageProcessor(cropEngine)
const selectedImage = computed(() => store.activeImage)

const workspaceRef = ref<InstanceType<typeof AppCanvasWorkspace> | null>(null)
const containerRef = computed(() => workspaceRef.value?.containerRef)

const resetView = () => {
  const img = selectedImage.value
  if (!img || !img.width) return
  workspaceRef.value?.triggerAutoFit(img.width, img.height!)
}

const pxCoords = computed({
  get: () => {
    const img = selectedImage.value
    if (!img || !img.width || !img.height) return { x: 0, y: 0, w: 0, h: 0 }
    return {
      x: Math.round((internalCrop.value.x / 100) * img.width),
      y: Math.round((internalCrop.value.y / 100) * img.height),
      w: Math.round((internalCrop.value.w / 100) * img.width),
      h: Math.round((internalCrop.value.h / 100) * img.height)
    }
  },
  set: (val) => {
    const img = selectedImage.value
    if (!img || !img.width || !img.height) return
    internalCrop.value = {
      x: (val.x / img.width) * 100,
      y: (val.y / img.height) * 100,
      w: (val.w / img.width) * 100,
      h: (val.h / img.height) * 100
    }
  }
})

const handlePxInputChange = (key: 'x' | 'y' | 'w' | 'h', val: number) => {
  recordBeforeAction()
  const newCoords = { ...pxCoords.value }
  newCoords[key] = val
  pxCoords.value = newCoords
}

const onCropChange = (data: any) => {
  if (data.isDragging && !isDragging.value) recordBeforeAction()
  isDragging.value = data.isDragging
  isSnapping.value = data.isSnapping
}

useResizeObserver(containerRef, resetView)
const handleReset = () => {
  recordBeforeAction()
  rotation.value = 0
  flipH.value = false
  flipV.value = false
  currentRatio.value = 0
  internalCrop.value = { x: 0, y: 0, w: 100, h: 100 }
  trimPx.value = { top: 0, bottom: 0, left: 0, right: 0 }
  isTransparent.value = true
  resetView()
}

watch(
  () => store.activeId,
  async (id) => {
    if (id) {
      clearHistory()
      await nextTick()
      resetView()
    }
  },
  { immediate: true }
)

const handleProcess = async () => {
  const img = selectedImage.value
  if (!img) return
  await processSingle(img.id, {
    x: internalCrop.value.x,
    y: internalCrop.value.y,
    width: internalCrop.value.w,
    height: internalCrop.value.h,
    usePercentage: true,
    rotation: rotation.value,
    flipH: flipH.value,
    flipV: flipV.value,
    fillColor: finalFillColor.value,
    trimPx: trimPx.value,
    format: outputFormat.value === 'original' ? undefined : outputFormat.value,
    quality: outputQuality.value,
    preserveExif: preserveExif.value
  })
}

const ratios = [
  { label: '自由', value: 0, icon: Scissors },
  { label: '1:1', value: 1, icon: Square },
  { label: '4:3', value: 4 / 3, icon: Icon43 },
  { label: '16:9', value: 16 / 9, icon: Icon169 },
  { label: '2:3', value: 2 / 3, icon: Icon23 }
]
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
    <template #header-left><ImageSelectionStatus /></template>
    <template #header-actions
      ><ImageActionsToolbar :is-processing="isProcessing" show-clear-all
    /></template>

    <template #content>
      <AppCanvasWorkspace ref="workspaceRef" @reset="resetView">
        <template #default="{ scale }">
          <div v-if="selectedImage" class="relative z-10 shadow-xl">
            <CropBox
              :image-url="selectedImage.preview"
              :aspect-ratio="currentRatio"
              v-model="internalCrop"
              :grid-mode="gridMode"
              :fill-color="finalFillColor"
              :scale="scale"
              @change="onCropChange"
            />
          </div>
        </template>

        <template #floating>
          <div
            class="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-2 z-40 transition-opacity duration-300"
            :class="isDragging ? 'opacity-100' : 'opacity-0'"
          >
            <div
              v-if="isSnapping"
              class="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-lg"
            >
              已吸附 (Alt停用)
            </div>
            <div
              class="px-4 py-2 bg-black/80 text-white rounded-xl border border-white/10 text-xs font-mono font-bold shadow-xl"
            >
              {{ pxCoords.w }} × {{ pxCoords.h }} PX
            </div>
          </div>
        </template>
      </AppCanvasWorkspace>
    </template>

    <template #sidebar>
      <!-- 第一分区：核心裁剪控制 -->
      <section class="space-y-4">
        <AppSectionHeader title="裁剪比例" :icon="Scissors" />
        <div class="bg-muted/10 rounded-2xl p-3 border border-border/60 space-y-4">
          <AppSegmentedControl
            v-model="currentRatio"
            :options="ratios"
            @update:model-value="handleRatioChange"
          />
          <div class="pt-1">
            <AppSegmentedControl
              v-model="gridMode"
              size="sm"
              :options="[
                { label: '无参考', value: 'none', icon: Maximize2 },
                { label: '三分法', value: 'thirds', icon: Grid3X3 }
              ]"
            />
          </div>
        </div>
      </section>

      <!-- 第二分区：精确坐标与填充 -->
      <section class="space-y-4 pt-2">
        <AppSectionHeader title="精确构图" :icon="LayoutGrid" />
        <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-5">
          <!-- 坐标设置 -->
          <div class="grid grid-cols-2 gap-x-3 gap-y-4 relative">
            <div class="space-y-1.5">
              <label
                class="text-[10px] font-black text-muted-foreground uppercase ml-1 tracking-widest"
                >X 坐标</label
              >
              <AppInput
                type="number"
                :model-value="Math.round(pxCoords.x)"
                @update:model-value="handlePxInputChange('x', $event)"
                class="h-10 text-xs font-mono bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <label
                class="text-[10px] font-black text-muted-foreground uppercase ml-1 tracking-widest"
                >Y 坐标</label
              >
              <AppInput
                type="number"
                :model-value="Math.round(pxCoords.y)"
                @update:model-value="handlePxInputChange('y', $event)"
                class="h-10 text-xs font-mono bg-background/50"
              />
            </div>

            <!-- 尺寸设置 (带联动锁定图标) -->
            <div class="col-span-2 grid grid-cols-2 gap-x-3 relative mt-1">
              <div class="space-y-1.5">
                <label
                  class="text-[10px] font-black uppercase ml-1 tracking-widest transition-colors"
                  :class="currentRatio > 0 ? 'text-primary' : 'text-muted-foreground'"
                  >宽度 (W)</label
                >
                <AppInput
                  type="number"
                  :model-value="Math.round(pxCoords.w)"
                  @update:model-value="handlePxInputChange('w', $event)"
                  class="h-10 text-xs font-mono transition-all"
                  :class="
                    currentRatio > 0
                      ? 'border-primary/40 bg-primary/[0.03] ring-1 ring-primary/10'
                      : 'border-border bg-background/50'
                  "
                />
              </div>

              <!-- 核心：联动指示器 -->
              <div
                class="absolute left-1/2 top-[2.1rem] -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center"
              >
                <div
                  class="bg-background border rounded-full p-1 shadow-sm transition-all duration-500"
                  :class="
                    currentRatio > 0
                      ? 'border-primary/40 text-primary scale-110 shadow-primary/10 rotate-0'
                      : 'border-border text-muted-foreground/40 scale-90 rotate-[-45deg]'
                  "
                >
                  <component :is="currentRatio > 0 ? LinkIcon : Unlink" :size="12" />
                </div>
              </div>

              <div class="space-y-1.5">
                <label
                  class="text-[10px] font-black uppercase ml-1 tracking-widest transition-colors"
                  :class="currentRatio > 0 ? 'text-primary' : 'text-muted-foreground'"
                  >高度 (H)</label
                >
                <AppInput
                  type="number"
                  :model-value="Math.round(pxCoords.h)"
                  @update:model-value="handlePxInputChange('h', $event)"
                  class="h-10 text-xs font-mono transition-all"
                  :class="
                    currentRatio > 0
                      ? 'border-primary/40 bg-primary/[0.03] ring-1 ring-primary/10'
                      : 'border-border bg-background/50'
                  "
                />
              </div>
            </div>
          </div>

          <!-- 画布填充 -->
          <div class="space-y-3 pt-1">
            <div
              class="text-[10px] font-black text-muted-foreground uppercase ml-1 tracking-widest"
            >
              画布填充颜色
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="setFillColor('transparent')"
                class="relative flex-1 h-10 rounded-xl border-2 transition-all flex items-center justify-center gap-2 overflow-hidden group"
                :class="
                  isTransparent
                    ? 'border-primary ring-2 ring-primary/10'
                    : 'border-border grayscale opacity-60 hover:opacity-100 hover:grayscale-0'
                "
              >
                <div class="absolute inset-0 transparency-grid opacity-60"></div>
                <span
                  class="relative z-10 text-[10px] font-black uppercase drop-shadow-sm group-hover:scale-110 transition-transform"
                  >透明</span
                >
              </button>
              <button
                @click="setFillColor('#ffffff')"
                class="w-10 h-10 rounded-xl border-2 transition-all bg-white hover:scale-110 active:scale-95"
                :class="
                  !isTransparent && customFillColor === '#ffffff'
                    ? 'border-primary shadow-md'
                    : 'border-border'
                "
              ></button>
              <button
                @click="setFillColor('#000000')"
                class="w-10 h-10 rounded-xl border-2 transition-all bg-black hover:scale-110 active:scale-95"
                :class="
                  !isTransparent && customFillColor === '#000000'
                    ? 'border-primary shadow-md'
                    : 'border-border'
                "
              ></button>
              <div class="relative w-10 h-10 group">
                <input
                  type="color"
                  v-model="customFillColor"
                  @input="isTransparent = false"
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div
                  class="w-full h-full rounded-xl border-2 flex items-center justify-center overflow-hidden transition-all group-hover:scale-110 active:scale-95"
                  :style="{ backgroundColor: customFillColor }"
                  :class="
                    !isTransparent && customFillColor !== '#ffffff' && customFillColor !== '#000000'
                      ? 'border-primary shadow-md'
                      : 'border-border'
                  "
                >
                  <div
                    class="w-2 h-2 rounded-full bg-white/50 border border-white/20 shadow-sm"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 第三分区：边缘精修与变换 -->
      <section class="space-y-4 pt-2">
        <AppSectionHeader title="高级变换" :icon="Settings2" />
        <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-6">
          <!-- TRIM -->
          <div class="space-y-4">
            <div
              class="text-[10px] font-black text-muted-foreground uppercase ml-1 tracking-widest flex items-center justify-between"
            >
              <span>边缘微调 (TRIM)</span>
              <span class="text-[9px] opacity-40 font-mono italic">UNIT: PX</span>
            </div>
            <div class="grid grid-cols-2 gap-x-6 gap-y-4">
              <AppSlider v-model="trimPx.top" label="上" :min="0" :max="100" />
              <AppSlider v-model="trimPx.bottom" label="下" :min="0" :max="100" />
              <AppSlider v-model="trimPx.left" label="左" :min="0" :max="100" />
              <AppSlider v-model="trimPx.right" label="右" :min="0" :max="100" />
            </div>
          </div>

          <!-- 变换按钮 -->
          <div class="pt-2 border-t border-border/40 space-y-4">
            <div class="grid grid-cols-3 gap-2">
              <button
                @click="handleRotate"
                class="flex flex-col items-center gap-2 p-3 rounded-xl border bg-background/50 hover:bg-primary/5 hover:border-primary/30 transition-all group"
              >
                <RotateCw
                  :size="18"
                  class="text-muted-foreground group-hover:text-primary transition-colors"
                /><span
                  class="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter"
                  >顺时针旋转</span
                >
              </button>
              <button
                @click="handleFlipH"
                class="flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group"
                :class="
                  flipH
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-background/50 border-border text-muted-foreground hover:bg-primary/5 hover:border-primary/30'
                "
              >
                <FlipHorizontal
                  :size="18"
                  class="group-hover:text-primary transition-colors"
                /><span class="text-[9px] font-bold uppercase tracking-tighter">水平翻转</span>
              </button>
              <button
                @click="handleFlipV"
                class="flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group"
                :class="
                  flipV
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-background/50 border-border text-muted-foreground hover:bg-primary/5 hover:border-primary/30'
                "
              >
                <FlipVertical :size="18" class="group-hover:text-primary transition-colors" /><span
                  class="text-[9px] font-bold uppercase tracking-tighter"
                  >垂直翻转</span
                >
              </button>
            </div>

            <!-- 历史记录 -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex-1 grid grid-cols-2 gap-2">
                <AppButton
                  variant="secondary"
                  size="sm"
                  :disabled="!canUndo"
                  @click="undo"
                  class="rounded-xl h-9 text-[10px] font-bold uppercase"
                  ><Undo2 :size="14" class="mr-1.5" /> 撤销</AppButton
                >
                <AppButton
                  variant="secondary"
                  size="sm"
                  :disabled="!canRedo"
                  @click="redo"
                  class="rounded-xl h-9 text-[10px] font-bold uppercase"
                  ><Redo2 :size="14" class="mr-1.5" /> 重做</AppButton
                >
              </div>
              <button
                @click="handleReset"
                class="w-9 h-9 flex items-center justify-center hover:bg-muted rounded-xl text-muted-foreground/40 hover:text-primary transition-all active:scale-90 border border-transparent hover:border-border"
                title="重置所有设置"
              >
                <RotateCcw :size="16" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <AppExportSettings
        v-model:format="outputFormat"
        v-model:quality="outputQuality"
        v-model:preserve-exif="preserveExif"
        show-exif-option
        title="导出保存"
        class="pt-2 pb-6"
      />
    </template>

    <template #footer>
      <InspectorFooter class="bg-background/95 backdrop-blur-md border-t border-border/60">
        <AppButton
          variant="cta"
          class="w-full h-12 rounded-xl shadow-lg transition-all active:scale-95 group overflow-hidden"
          :loading="isProcessing"
          @click="handleProcess"
        >
          <template #icon><Scissors v-if="!isProcessing" :size="18" class="mr-2" /></template>
          <span class="font-bold text-sm uppercase tracking-tight">{{
            isProcessing ? '导出处理中...' : '裁剪并保存导出'
          }}</span>
        </AppButton>
      </InspectorFooter>
    </template>
  </WorkspaceLayout>
</template>

<style scoped>
section {
  @apply transition-all duration-300;
}

/* 隐藏输入框上下箭头 */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type='number'] {
  -moz-appearance: textfield;
}
</style>
