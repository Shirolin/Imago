<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import ImageUpload from '../components/common/ImageUpload.vue'
import { 
  Palette, X, Download, Loader2, Trash2, 
  Settings2, Sun, Contrast, Droplets,
  RotateCcw, Check, Sparkles, Image as ImageIcon,
  Plus, CheckSquare, Square, CheckCircle2
} from 'lucide-vue-next'

const store = useImageStore()
const activeImageId = ref<string | null>(null)
const isProcessing = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

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

const triggerFileInput = () => {
  fileInput.value?.click()
}

const onFileChange = (e: Event) => {
  const files = (e.target as HTMLInputElement).files
  if (files) {
    store.addImages(Array.from(files))
  }
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
  applyPreset(presets[0])
}

const handleCardClick = (id: string) => {
  activeImageId.value = id
  store.toggleSelection(id)
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<template>
  <div class="view-container">
    <div v-if="store.images.length === 0" class="empty-state">
      <ImageUpload @upload="store.addImages" />
    </div>
    
    <div v-else class="workspace">
      <!-- Left: Image Grid -->
      <div class="main-area">
        <header class="area-header">
          <div class="header-left">
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
          </div>

          <div class="header-actions">
            <input type="file" ref="fileInput" multiple accept="image/*" @change="onFileChange" style="display: none">
            <button @click="triggerFileInput" class="btn-tool">
              <Plus :size="18" /> 添加图片
            </button>
            <button @click="store.removeSelected" class="btn-tool" :disabled="!store.selectedCount">
              <Trash2 :size="18" /> 删除选中
            </button>
            <button @click="store.clearImages" class="btn-tool">
              <X :size="18" /> 清空全部
            </button>
          </div>
        </header>

        <div class="image-grid-wrapper custom-scrollbar">
          <div class="image-grid">
            <div 
              v-for="img in store.images" 
              :key="img.id" 
              class="image-card" 
              :class="[img.status, { selected: store.selectedIds.has(img.id), active: activeImage?.id === img.id }]"
              @click="handleCardClick(img.id)"
            >
              <div class="card-selection" :class="{ active: store.selectedIds.has(img.id) }">
                <CheckSquare v-if="store.selectedIds.has(img.id)" :size="18" />
                <Square v-else :size="18" />
              </div>

              <div class="card-preview">
                <img :src="img.preview" alt="Preview" :style="activeImage?.id === img.id ? filterStyle : {}">
                <div v-if="img.status === 'processing'" class="status-overlay">
                  <Loader2 class="spin" :size="24" />
                </div>
                
                <!-- Success Badge (Replaces full overlay) -->
                <div v-if="img.status === 'done'" class="success-indicator">
                  <CheckCircle2 :size="16" />
                </div>
              </div>
              <div class="card-meta">
                <div class="meta-top">
                  <span class="name" :title="img.file.name">{{ img.file.name }}</span>
                  <span class="size">{{ formatSize(img.originalSize) }}</span>
                </div>

                <div class="status-row">
                  <div class="status-pill" :class="img.status">
                    <div class="pulse-dot"></div>
                    <span>{{ img.status === 'done' ? '滤镜已应用' : (img.status === 'error' ? '失败' : '等待处理') }}</span>
                  </div>
                  <button v-if="img.status === 'done'" class="mini-download">
                    <Download :size="14" />
                  </button>
                </div>
              </div>
              <button @click.stop="store.removeImage(img.id)" class="remove-btn">
                <X :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Control Panel -->
      <aside class="control-panel custom-scrollbar" style="overflow-y: auto;">
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
              <div class="adjust-label">
                <Sparkles :size="14" /> 模糊
                <span class="val">{{ blur }}px</span>
              </div>
              <input type="range" v-model.number="blur" min="0" max="20" class="pro-slider">
            </div>
            <div class="adjust-item">
              <div class="adjust-label">
                灰度
                <span class="val">{{ grayscale }}%</span>
              </div>
              <input type="range" v-model.number="grayscale" min="0" max="100" class="pro-slider">
            </div>
          </div>
        </div>

        <div class="panel-footer">
          <button @click="handleApplyFilters" class="btn-apply" :disabled="isProcessing">
            <Loader2 v-if="isProcessing" class="spin" :size="18" />
            <Check v-else :size="18" />
            {{ isProcessing ? '正在处理...' : '执行处理' }}
          </button>
          <p class="footer-hint">滤镜将应用到所有选中的图片</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  height: 100%;
  width: 100%;
  display: flex;
}

.empty-state {
  max-width: 900px;
  margin: auto;
  width: 100%;
  padding: 2rem;
}

.workspace {
  display: flex;
  width: 100%;
  height: 100%;
}

/* Main Area */
.main-area {
  flex: 1;
  padding: 2rem 3rem;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
  overflow: hidden;
}

.area-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--card-bg);
  padding: 1rem 1.5rem;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 0 var(--border-color);
  margin-bottom: 2rem;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
}

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
  background: var(--bg-color);
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
  font-weight: 800;
  font-size: 1rem;
  font-family: var(--font-heading);
}

.selection-info .label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-tool {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 0.6rem 1rem;
  border-radius: 10px;
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 0 var(--border-color);
}

.btn-tool:hover:not(:disabled) {
  transform: translateY(-2px);
  background: var(--card-bg);
}

.btn-tool:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: none;
}

.btn-tool:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.image-grid-wrapper {
  flex: 1;
  overflow-y: auto;
  padding-top: 1rem;
  margin-top: -1rem;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  padding: 0.5rem 0.5rem 2rem 0;
}

.image-card {
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 20px;
  padding: 1rem;
  position: relative;
  transition: all 0.3s;
  cursor: pointer;
}

.image-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.08);
}

.image-card.selected {
  border-color: var(--accent-color);
  background: rgba(34, 197, 94, 0.02);
}

.image-card.active {
  box-shadow: 0 0 0 2px var(--accent-color);
}

.card-selection {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 10;
  color: var(--text-secondary);
  background: var(--card-bg);
  border-radius: 6px;
  padding: 2px;
  display: flex;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.card-selection.active {
  color: var(--accent-color);
  border-color: var(--accent-color);
}

.card-preview {
  height: 160px;
  background: var(--bg-color);
  border-radius: 12px;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.card-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.status-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  backdrop-filter: blur(2px);
}

.success-indicator {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: var(--accent-color);
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 8px rgba(34, 197, 94, 0.4);
  z-index: 5;
  animation: scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scale-in {
  from { transform: scale(0); }
  to { transform: scale(1); }
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.meta-top {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.card-meta .name {
  font-weight: 700;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
}

.card-meta .size {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.status-pill {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 4px 8px;
  background: var(--bg-color);
  border-radius: 99px;
  border: 1px solid var(--border-color);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.status-pill.done {
  color: var(--accent-color);
  border-color: rgba(34, 197, 94, 0.2);
  background: rgba(34, 197, 94, 0.05);
}

.pulse-dot {
  width: 5px;
  height: 6px;
  background: var(--border-color);
  border-radius: 50%;
}

.status-pill.done .pulse-dot {
  background: var(--accent-color);
  box-shadow: 0 0 6px var(--accent-color);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}

.mini-download {
  background: var(--accent-color);
  color: white;
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 0 #15803d;
  transition: all 0.2s;
}

.mini-download:hover {
  transform: translateY(-1px);
}

.remove-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s;
}

.image-card:hover .remove-btn {
  opacity: 1;
  transform: scale(1);
}

/* Control Panel */
.control-panel {
  width: 380px;
  background: var(--card-bg);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  padding: 2.5rem;
  gap: 2rem;
  z-index: 5;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--font-heading);
  font-weight: 800;
  font-size: 0.9rem;
  color: var(--text-primary);
  margin-bottom: 1.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mini-viewport {
  height: 180px;
  background: var(--bg-color);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.mini-viewport img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.no-selection {
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.preset-btn {
  padding: 0.6rem;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.preset-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: var(--card-bg);
}

.reset-btn-text {
  background: none;
  border: none;
  color: var(--accent-color);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.adjust-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.adjust-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.adjust-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
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
  height: 6px;
  background: var(--bg-color);
  border-radius: 3px;
}

.pro-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: var(--accent-color);
  border: 3px solid var(--card-bg);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.2);
}

.panel-footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.btn-apply {
  width: 100%;
  padding: 1.25rem;
  background: var(--accent-color);
  color: #FFFFFF;
  border: none;
  border-radius: 16px;
  font-family: var(--font-heading);
  font-size: 1.1rem;
  font-weight: 800;
  box-shadow: 0 8px 24px rgba(34, 197, 94, 0.3);
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.btn-apply:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(34, 197, 94, 0.4);
}

.btn-apply:active {
  transform: translateY(0);
}

.btn-apply:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.footer-hint {
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
