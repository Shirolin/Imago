<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import { 
  Palette, X, Loader2, Settings2, Sun, Contrast, Droplets,
  Check, Sparkles, Image as ImageIcon, Plus, Trash2, Square, CheckSquare
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
  return store.images.find(img => img.id === activeImageId.value) || store.images[0]
})

const filterStyle = computed(() => {
  return {
    filter: `brightness(${brightness.value}%) contrast(${contrast.value}%) saturate(${saturation.value}%) blur(${blur.value}px) grayscale(${grayscale.value}%) sepia(${sepia.value}%)`
  }
})

const presets = [
  { name: '默认', values: { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: 0, sepia: 0 } },
  { name: '明亮', values: { brightness: 120, contrast: 110, saturation: 110, blur: 0, grayscale: 0, sepia: 0 } },
  { name: '复古', values: { brightness: 100, contrast: 90, saturation: 80, blur: 0, grayscale: 0, sepia: 80 } },
  { name: '黑白', values: { brightness: 100, contrast: 120, saturation: 0, blur: 0, grayscale: 100, sepia: 0 } },
  { name: '柔和', values: { brightness: 110, contrast: 90, saturation: 90, blur: 2, grayscale: 0, sepia: 0 } }
]

const applyPreset = (preset: typeof presets[0]) => {
  brightness.value = preset.values.brightness
  contrast.value = preset.values.contrast
  saturation.value = preset.values.saturation
  blur.value = preset.values.blur
  grayscale.value = preset.values.grayscale
  sepia.value = preset.values.sepia
}

const handleApplyFilters = async () => {
  isProcessing.value = true
  await new Promise(resolve => setTimeout(resolve, 1500))
  store.images.forEach(img => {
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
      <div class="select-control" @click="store.toggleAll">
        <div class="checkbox-wrapper">
          <CheckSquare v-if="store.isAllSelected" :size="20" class="checked" />
          <Square v-else :size="20" />
        </div>
        <div class="selection-info">
          <span class="count">已选择 {{ store.selectedCount }} / {{ store.images.length }}</span>
          <span class="label">全选/反选</span>
        </div>
      </div>
    </template>

    <template #header-actions>
      <input type="file" ref="fileInput" multiple accept="image/*" @change="handleFileChange" style="display: none">
      <AppButton variant="tool" @click="triggerFileInput">
        <template #icon><Plus :size="18" /></template>
        添加图片
      </AppButton>
      <AppButton variant="tool" :disabled="!store.selectedCount" @click="store.removeSelected">
        <template #icon><Trash2 :size="18" /></template>
        删除选中
      </AppButton>
      <AppButton variant="tool" @click="store.clearImages">
        <template #icon><X :size="18" /></template>
        清空全部
      </AppButton>
    </template>

    <template #content>
      <ImageCard 
        v-for="img in store.images" 
        :key="img.id" 
        :image="img"
        :is-selected="store.selectedIds.has(img.id)"
        :class="{ active: activeImage?.id === img.id }"
        @click="handleCardClick(img.id)"
        @toggle="store.toggleSelection"
        @remove="store.removeImage"
      >
        <template #overlay="{ image }">
          <div class="card-filter-overlay" v-if="activeImage?.id === image.id" :style="filterStyle"></div>
        </template>
      </ImageCard>
    </template>

    <template #sidebar>
      <div class="sidebar-content">
        <div class="panel-section preview-mini">
          <div class="section-title">
            <ImageIcon :size="18" /> 当前预览
          </div>
          <div class="mini-viewport">
            <img v-if="activeImage" :src="activeImage.preview" :style="filterStyle" alt="Preview">
            <div v-else class="no-selection">请选择图片</div>
          </div>
        </div>

        <div class="panel-section">
          <div class="section-title">
            <Sparkles :size="18" /> 预设滤镜
          </div>
          <div class="preset-grid">
            <button 
              v-for="preset in presets" 
              :key="preset.name" 
              class="preset-btn"
              @click="applyPreset(preset)"
            >
              {{ preset.name }}
            </button>
          </div>
        </div>

        <div class="panel-section">
          <div class="section-title">
            <Settings2 :size="18" /> 手动调整
            <button @click="resetFilters" class="reset-btn-text">重置</button>
          </div>
          
          <div class="adjust-list">
            <div class="adjust-item">
              <div class="adjust-label">
                <Sun :size="14" /> 亮度
                <span class="val">{{ brightness }}%</span>
              </div>
              <input type="range" v-model.number="brightness" min="0" max="200" class="pro-slider">
            </div>
            <div class="adjust-item">
              <div class="adjust-label">
                <Contrast :size="14" /> 对比度
                <span class="val">{{ contrast }}%</span>
              </div>
              <input type="range" v-model.number="contrast" min="0" max="200" class="pro-slider">
            </div>
            <div class="adjust-item">
              <div class="adjust-label">
                <Droplets :size="14" /> 饱和度
                <span class="val">{{ saturation }}%</span>
              </div>
              <input type="range" v-model.number="saturation" min="0" max="200" class="pro-slider">
            </div>
            <div class="adjust-item">
              <div class="adjust-label">灰度 <span class="val">{{ grayscale }}%</span></div>
              <input type="range" v-model.number="grayscale" min="0" max="100" class="pro-slider">
            </div>
          </div>
        </div>

        <div class="panel-footer">
          <AppButton size="lg" :loading="isProcessing" @click="handleApplyFilters">
            <template #icon><Check v-if="!isProcessing" :size="20" /></template>
            执行滤镜处理
          </AppButton>
          <p class="footer-hint">滤镜将应用到所有选中的图片</p>
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>

<style scoped>
.select-control {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 10px;
  transition: all 0.2s;
}

.select-control:hover {
  background: var(--hover-bg);
}

.checkbox-wrapper {
  color: var(--text-secondary);
  display: flex;
  align-items: center;
}

.checkbox-wrapper .checked {
  color: var(--accent-color);
}

.selection-info {
  display: flex;
  flex-direction: column;
}

.selection-info .count {
  font-weight: 700;
  font-size: 0.95rem;
}

.selection-info .label {
  font-size: 0.65rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
}

.sidebar-content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  height: 100%;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.mini-viewport {
  height: 160px;
  background: var(--bg-color);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.mini-viewport img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.no-selection {
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
}

.preset-btn {
  padding: 0.5rem;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
}

.preset-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.reset-btn-text {
  background: none;
  border: none;
  color: var(--accent-color);
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
}

.adjust-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.adjust-item {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.adjust-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.adjust-label .val {
  margin-left: auto;
  color: var(--accent-color);
}

.pro-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  background: var(--bg-color);
  border-radius: 2px;
}

.pro-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent-color);
  border: 2px solid var(--card-bg);
  border-radius: 50%;
  cursor: pointer;
}

.panel-footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.footer-hint {
  text-align: center;
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.card-filter-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>
