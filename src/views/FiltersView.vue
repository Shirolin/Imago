<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import {
  Palette,
  X,
  Loader2,
  Settings2,
  Sun,
  Contrast,
  Droplets,
  Check,
  Sparkles,
  Image as ImageIcon,
  Plus,
  Trash2,
  Square,
  CheckSquare
} from 'lucide-vue-next'

const store = useImageStore()
const { fileInput, triggerFileInput, handleFileChange, downloadImage } = useFileHelpers()

const activeImageId = ref<string | null>(null)
const isProcessing = ref(false)

const brightness = ref(100)
const contrast = ref(100)
const saturation = ref(100)
const blur = ref(0)
const grayscale = ref(0)
const sepia = ref(0)

const activeImage = computed(() => {
  return store.images.find((img) => img.id === activeImageId.value) || store.images[0]
})

const filterStyle = computed(() => {
  return {
    filter: `brightness(${brightness.value}%) contrast(${contrast.value}%) saturate(${saturation.value}%) blur(${blur.value}px) grayscale(${grayscale.value}%) sepia(${sepia.value}%)`
  }
})

const presets = [
  {
    name: '默认',
    values: { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: 0, sepia: 0 }
  },
  {
    name: '明亮',
    values: { brightness: 120, contrast: 110, saturation: 110, blur: 0, grayscale: 0, sepia: 0 }
  },
  {
    name: '复古',
    values: { brightness: 100, contrast: 90, saturation: 80, blur: 0, grayscale: 0, sepia: 80 }
  },
  {
    name: '黑白',
    values: { brightness: 100, contrast: 120, saturation: 0, blur: 0, grayscale: 100, sepia: 0 }
  },
  {
    name: '柔和',
    values: { brightness: 110, contrast: 90, saturation: 90, blur: 2, grayscale: 0, sepia: 0 }
  }
]

const applyPreset = (preset: (typeof presets)[0]) => {
  brightness.value = preset.values.brightness
  contrast.value = preset.values.contrast
  saturation.value = preset.values.saturation
  blur.value = preset.values.blur
  grayscale.value = preset.values.grayscale
  sepia.value = preset.values.sepia
}

const handleApplyFilters = async () => {
  isProcessing.value = true
  await new Promise((resolve) => setTimeout(resolve, 1500))
  store.images.forEach((img) => {
    if (store.selectedIds.size === 0 || store.selectedIds.has(img.id)) {
      store.updateImage(img.id, { status: 'done' })
    }
  })
  isProcessing.value = false
}

const resetFilters = () => {
  applyPreset(presets[0]!)
}

const handleCardClick = (id: string) => {
  activeImageId.value = id
  store.toggleSelection(id)
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
        :class="{
          'ring-2 ring-primary ring-offset-2 ring-offset-background': activeImage?.id === img.id
        }"
        @click="handleCardClick(img.id)"
        @toggle="store.toggleSelection"
        @remove="store.removeImage"
      >
        <template #overlay="{ image }">
          <div
            class="absolute inset-0 pointer-events-none"
            v-if="activeImage?.id === image.id"
            :style="filterStyle"
          ></div>
        </template>
      </ImageCard>
    </template>

    <template #sidebar>
      <div class="p-6 flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar">
        <div class="flex flex-col gap-4 shrink-0">
          <div class="flex items-center gap-2 font-bold text-[0.85rem] text-foreground uppercase">
            <ImageIcon :size="18" class="text-primary" /> 当前预览
          </div>
          <div
            class="h-[160px] bg-muted rounded-xl border border-border flex items-center justify-center overflow-hidden shadow-inner relative"
          >
            <img
              v-if="activeImage"
              :src="activeImage.preview"
              :style="filterStyle"
              alt="Preview"
              class="max-w-full max-h-full object-contain"
            />
            <div v-else class="text-xs font-bold text-muted-foreground">请选择图片</div>
          </div>
        </div>

        <div class="flex flex-col gap-4 shrink-0">
          <div class="flex items-center gap-2 font-bold text-[0.85rem] text-foreground uppercase">
            <Sparkles :size="18" class="text-primary" /> 预设滤镜
          </div>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="preset in presets"
              :key="preset.name"
              class="p-2 bg-muted border border-border rounded-lg text-[0.7rem] font-bold text-foreground cursor-pointer transition-colors hover:border-primary hover:text-primary active:scale-[0.98]"
              @click="applyPreset(preset)"
            >
              {{ preset.name }}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-5 shrink-0">
          <div
            class="flex items-center justify-between font-bold text-[0.85rem] text-foreground uppercase"
          >
            <div class="flex items-center gap-2">
              <Settings2 :size="18" class="text-primary" /> 手动调整
            </div>
            <button
              @click="resetFilters"
              class="text-[0.7rem] font-bold text-primary hover:text-primary/80 transition-colors bg-transparent border-none cursor-pointer"
            >
              重置
            </button>
          </div>

          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <div class="flex items-center text-[0.7rem] font-bold text-muted-foreground">
                <Sun :size="14" class="mr-1.5" /> 亮度
                <span class="ml-auto text-primary">{{ brightness }}%</span>
              </div>
              <input
                type="range"
                v-model.number="brightness"
                min="0"
                max="200"
                class="w-full h-1 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer shadow-[0_0_0_2px_hsl(var(--card))] border-none focus:outline-none"
              />
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center text-[0.7rem] font-bold text-muted-foreground">
                <Contrast :size="14" class="mr-1.5" /> 对比度
                <span class="ml-auto text-primary">{{ contrast }}%</span>
              </div>
              <input
                type="range"
                v-model.number="contrast"
                min="0"
                max="200"
                class="w-full h-1 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer shadow-[0_0_0_2px_hsl(var(--card))] border-none focus:outline-none"
              />
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center text-[0.7rem] font-bold text-muted-foreground">
                <Droplets :size="14" class="mr-1.5" /> 饱和度
                <span class="ml-auto text-primary">{{ saturation }}%</span>
              </div>
              <input
                type="range"
                v-model.number="saturation"
                min="0"
                max="200"
                class="w-full h-1 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer shadow-[0_0_0_2px_hsl(var(--card))] border-none focus:outline-none"
              />
            </div>

            <div class="flex flex-col gap-2">
              <div
                class="flex items-center justify-between text-[0.7rem] font-bold text-muted-foreground"
              >
                灰度
                <span class="text-primary">{{ grayscale }}%</span>
              </div>
              <input
                type="range"
                v-model.number="grayscale"
                min="0"
                max="100"
                class="w-full h-1 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer shadow-[0_0_0_2px_hsl(var(--card))] border-none focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div class="mt-auto shrink-0 flex flex-col gap-3 pt-6">
          <AppButton size="lg" variant="cta" :loading="isProcessing" @click="handleApplyFilters">
            <template #icon><Check v-if="!isProcessing" :size="20" class="mr-2" /></template>
            执行滤镜处理
          </AppButton>
          <p class="text-center text-xs text-muted-foreground">滤镜将应用到所有选中的图片</p>
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>
