<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import {
  Settings2,
  Sun,
  Contrast,
  Droplets,
  Check,
  Sparkles,
  Image as ImageIcon
} from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSlider from '../components/common/AppSlider.vue'
import { filterEngine } from '../lib/engines/filterEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

const store = useImageStore()

const activeImageId = ref<string | null>(null)

const brightness = ref(100)
const contrast = ref(100)
const saturation = ref(100)
const blur = ref(0)
const grayscale = ref(0)
const sepia = ref(0)

const { isProcessing, processSelected } = useImageProcessor(filterEngine)

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

const handleApplyFilters = () => {
  processSelected({
    brightness: brightness.value,
    contrast: contrast.value,
    saturation: saturation.value,
    blur: blur.value,
    grayscale: grayscale.value,
    sepia: sepia.value
  })
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
      <div class="flex flex-col h-full bg-card/40 backdrop-blur-sm border-l border-border/50">
        <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10">
          <!-- 1. 沉浸式预览区 -->
          <section class="space-y-4">
            <div class="flex items-center justify-between px-0.5">
              <AppSectionHeader title="当前预览" :icon="ImageIcon" />
              <span class="text-[0.6rem] font-black text-primary/60 uppercase tracking-[0.2em]"
                >Real-time</span
              >
            </div>
            <div
              class="group relative aspect-video bg-slate-950 rounded-2xl border border-border/40 overflow-hidden shadow-soft ring-1 ring-white/5"
            >
              <img
                v-if="activeImage"
                :src="activeImage.preview"
                :style="filterStyle"
                alt="Preview"
                class="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
              />
              <div
                v-else
                class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/40"
              >
                <ImageIcon :size="32" stroke-width="1.5" />
                <span class="text-[0.65rem] font-bold uppercase tracking-widest"
                  >Select an Image</span
                >
              </div>

              <!-- 悬浮对比提示 -->
              <div
                v-if="activeImage"
                class="absolute bottom-3 right-3 px-2 py-1 bg-black/40 backdrop-blur-md rounded-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              >
                <span class="text-[0.55rem] font-black text-white uppercase tracking-widest"
                  >Preview Mode</span
                >
              </div>
            </div>
          </section>

          <!-- 2. 视觉化预设区 -->
          <section class="space-y-5">
            <AppSectionHeader title="风格预设" :icon="Sparkles" />
            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="preset in presets"
                :key="preset.name"
                @click="applyPreset(preset)"
                class="group relative flex flex-col gap-2 p-1 rounded-xl transition-all duration-300 hover:bg-muted/50 border border-transparent hover:border-border/60"
              >
                <div
                  class="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted border border-border/40 transition-all group-hover:shadow-soft"
                >
                  <img
                    v-if="activeImage"
                    :src="activeImage.preview"
                    :style="{
                      filter: `brightness(${preset.values.brightness}%) contrast(${preset.values.contrast}%) saturate(${preset.values.saturation}%) blur(${preset.values.blur}px) grayscale(${preset.values.grayscale}%) sepia(${preset.values.sepia}%)`
                    }"
                    class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                  <div
                    class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                  ></div>
                  <div
                    class="absolute bottom-1.5 left-2 text-[0.55rem] font-black text-white uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Apply
                  </div>
                </div>
                <span
                  class="text-[0.65rem] font-bold text-muted-foreground group-hover:text-primary transition-colors text-center pb-1 uppercase tracking-tighter"
                  >{{ preset.name }}</span
                >
              </button>
            </div>
          </section>

          <!-- 3. 精细调色面板 -->
          <section class="space-y-7">
            <div class="flex items-center justify-between px-0.5">
              <AppSectionHeader title="精细调色" :icon="Settings2" />
              <button
                @click="resetFilters"
                class="text-[0.6rem] font-black text-primary/60 hover:text-primary uppercase tracking-[0.2em] transition-colors"
              >
                Reset All
              </button>
            </div>

            <div
              class="space-y-9 bg-background/40 p-5 rounded-2xl border border-border/40 shadow-soft"
            >
              <!-- 曝光分组 -->
              <div class="space-y-6">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-1 h-3 bg-primary/40 rounded-full"></div>
                  <span
                    class="text-[0.55rem] font-black text-muted-foreground uppercase tracking-[0.2em]"
                    >Exposure</span
                  >
                </div>
                <AppSlider v-model="brightness" label="曝光亮度" :max="200" :icon="Sun" unit="%">
                  <template #default="{ modelValue }">
                    <span class="font-mono text-xs font-bold text-primary">{{ modelValue }}%</span>
                  </template>
                </AppSlider>
                <AppSlider v-model="contrast" label="对比强度" :max="200" :icon="Contrast" unit="%">
                  <template #default="{ modelValue }">
                    <span class="font-mono text-xs font-bold text-primary">{{ modelValue }}%</span>
                  </template>
                </AppSlider>
              </div>

              <!-- 色彩分组 -->
              <div class="space-y-6">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-1 h-3 bg-primary/40 rounded-full"></div>
                  <span
                    class="text-[0.55rem] font-black text-muted-foreground uppercase tracking-[0.2em]"
                    >Color & Tone</span
                  >
                </div>
                <AppSlider
                  v-model="saturation"
                  label="色彩饱和度"
                  :max="200"
                  :icon="Droplets"
                  unit="%"
                >
                  <template #default="{ modelValue }">
                    <span class="font-mono text-xs font-bold text-primary">{{ modelValue }}%</span>
                  </template>
                </AppSlider>
                <AppSlider v-model="grayscale" label="黑白深度" unit="%">
                  <template #default="{ modelValue }">
                    <span class="font-mono text-xs font-bold text-primary">{{ modelValue }}%</span>
                  </template>
                </AppSlider>
              </div>
            </div>
          </section>
        </div>

        <div
          class="p-6 bg-gradient-to-t from-card via-card to-transparent pt-12 mt-auto border-t border-border/40 relative z-20 shrink-0"
        >
          <AppButton
            size="lg"
            variant="cta"
            class="w-full h-14 rounded-2xl hover:-translate-y-0.5 transition-all duration-300 active:scale-95 shrink-0"
            :loading="isProcessing"
            @click="handleApplyFilters"
          >
            <template #icon
              ><Check v-if="!isProcessing" :size="20" class="mr-2.5 stroke-[3px]"
            /></template>
            <span class="tracking-tight uppercase font-black text-sm">Apply Changes</span>
          </AppButton>
          <p
            class="text-center text-[0.6rem] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mt-4"
          >
            Processing {{ store.selectedCount || store.images.length }} Assets
          </p>
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>
