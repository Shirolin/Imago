<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import ImageUpload from '../components/common/ImageUpload.vue'
import { 
  Scissors, X, Download, Loader2, Trash2, 
  Settings2, ChevronRight, AspectRatio, 
  RotateCw, FlipHorizontal, FlipVertical,
  Maximize, Minimize, RefreshCcw, Check,
  Plus, Square, CheckSquare
} from 'lucide-vue-next'

const store = useImageStore()
const selectedImageId = ref<string | null>(null)
const isProcessing = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const onFileChange = (e: Event) => {
  const files = (e.target as HTMLInputElement).files
  if (files) {
    store.addImages(Array.from(files))
  }
}

const selectedImage = computed(() => {
  return store.images.find(img => img.id === selectedImageId.value) || store.images[0]
})

const aspectRatios = [
  { label: '自由', value: 'free' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '16:9', value: '16:9' },
  { label: '2:3', value: '2:3' }
]
const currentRatio = ref('free')

const selectImage = (id: string) => {
  selectedImageId.value = id
}

const handleCrop = async () => {
  isProcessing.value = true
  await new Promise(resolve => setTimeout(resolve, 1000))
  isProcessing.value = false
  alert('裁剪功能逻辑待接入')
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
    <div v-if="store.images.length === 0" class="empty-state-wrapper">
      <div class="hero-section">
        <h1 class="hero-title">裁剪与构图</h1>
        <p class="hero-subtitle">精准裁剪每一像素，支持常用比例预设与自由调整。</p>
      </div>
      <ImageUpload @upload="store.addImages" />
    </div>
    
    <div v-else class="workspace">
      <header class="workspace-toolbar">
        <div class="toolbar-left">
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

        <div class="toolbar-actions">
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

      <div class="workspace-grid">
        <!-- Sidebar: Image List -->
        <aside class="image-sidebar">
          <div class="sidebar-card">
            <div class="panel-header">
              <h2>待处理队列</h2>
            </div>
            <div class="sidebar-list custom-scrollbar">
              <div 
                v-for="img in store.images" 
                :key="img.id" 
                class="list-item"
                :class="{ active: selectedImage?.id === img.id, selected: store.selectedIds.has(img.id) }"
                @click="selectImage(img.id)"
              >
                <div class="item-selection" @click.stop="store.toggleSelection(img.id)">
                  <CheckSquare v-if="store.selectedIds.has(img.id)" :size="16" class="checked" />
                  <Square v-else :size="16" />
                </div>
                <div class="item-preview">
                  <img :src="img.preview" alt="">
                </div>
                <div class="item-info">
                  <p class="item-name">{{ img.file.name }}</p>
                  <p class="item-meta">{{ formatSize(img.originalSize) }}</p>
                </div>
                <button @click.stop="store.removeImage(img.id)" class="item-remove">
                  <X :size="14" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        <!-- Main: Crop Area -->
        <main class="crop-main">
          <div class="crop-container-card">
            <div class="crop-viewport">
              <div v-if="selectedImage" class="preview-stage">
                <img :src="selectedImage.preview" alt="Crop Preview" class="main-crop-img">
                <!-- Placeholder for crop overlay -->
                <div class="crop-overlay-placeholder">
                  <div class="crop-grid"></div>
                  <div class="crop-handles">
                    <div class="handle tl"></div>
                    <div class="handle tr"></div>
                    <div class="handle bl"></div>
                    <div class="handle br"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="crop-controls">
              <div class="control-group">
                <span class="group-label">纵横比</span>
                <div class="ratio-buttons">
                  <button 
                    v-for="ratio in aspectRatios" 
                    :key="ratio.value"
                    :class="{ active: currentRatio === ratio.value }"
                    @click="currentRatio = ratio.value"
                  >
                    {{ ratio.label }}
                  </button>
                </div>
              </div>

              <div class="divider"></div>

              <div class="control-group">
                <span class="group-label">变换</span>
                <div class="action-buttons">
                  <button class="icon-btn" title="向右旋转90°"><RotateCw :size="18" /></button>
                  <button class="icon-btn" title="水平翻转"><FlipHorizontal :size="18" /></button>
                  <button class="icon-btn" title="垂直翻转"><FlipVertical :size="18" /></button>
                  <button class="icon-btn" title="重置修改"><RefreshCcw :size="18" /></button>
                </div>
              </div>

              <div class="ml-auto">
                <button @click="handleCrop" class="btn btn-primary" :disabled="isProcessing">
                  <Loader2 v-if="isProcessing" :size="20" class="animate-spin" />
                  <Check v-else :size="20" />
                  <span>应用裁剪</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  padding: 2.5rem;
  max-width: 1600px;
  margin: 0 auto;
  min-height: 100%;
}

.empty-state-wrapper {
  max-width: 800px;
  margin: 2rem auto;
}

.hero-section {
  text-align: center;
  margin-bottom: 3rem;
}

.hero-title {
  font-family: var(--font-heading);
  font-size: 3.5rem;
  font-weight: 800;
  margin-bottom: 1rem;
  letter-spacing: -0.04em;
  color: var(--text-primary);
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--text-secondary);
}

.text-accent {
  color: var(--accent-color);
}

/* Workspace Layout */
.workspace {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  height: 100%;
}

.workspace-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--card-bg);
  padding: 1rem 1.5rem;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  box-shadow: 4px 4px 0 var(--border-color);
  flex-shrink: 0;
}

.toolbar-left {
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

.toolbar-actions {
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
}

.btn-tool:hover:not(:disabled) {
  transform: translateY(-2px);
  background: var(--card-bg);
}

.btn-tool:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 2rem;
  align-items: stretch;
  flex: 1;
  min-height: 0;
}

/* Sidebar Card */
.sidebar-card {
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 4px 0px var(--border-color);
  overflow: hidden;
}

.panel-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.panel-header h2 {
  font-family: var(--font-heading);
  font-size: 1rem;
  font-weight: 700;
}

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
  margin-bottom: 0.5rem;
  position: relative;
}

.list-item:hover {
  background: var(--hover-bg);
}

.list-item.selected {
  background: rgba(34, 197, 94, 0.02);
  border-color: rgba(34, 197, 94, 0.2);
}

.list-item.active {
  background: rgba(34, 197, 94, 0.05);
  border-color: var(--accent-color);
}

.item-selection {
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  padding: 2px;
}

.item-selection .checked {
  color: var(--accent-color);
}

.item-preview {
  width: 50px;
  height: 50px;
  border-radius: 10px;
  background: var(--bg-color);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 0.85rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.15rem;
}

.item-meta {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.item-remove {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0;
}

.list-item:hover .item-remove {
  opacity: 1;
}

.item-remove:hover {
  background: #EF4444;
  color: white;
}

/* Crop Main Area */
.crop-main {
  height: 100%;
}

.crop-container-card {
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 6px 6px 0px var(--border-color);
  overflow: hidden;
}

.crop-viewport {
  flex: 1;
  background: var(--bg-color);
  margin: 1.5rem;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background-image: radial-gradient(var(--border-color) 1px, transparent 1px);
  background-size: 20px 20px;
}

.preview-stage {
  position: relative;
  max-width: 90%;
  max-height: 90%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.main-crop-img {
  max-width: 100%;
  max-height: 100%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.crop-overlay-placeholder {
  position: absolute;
  top: 10%;
  left: 10%;
  right: 10%;
  bottom: 10%;
  border: 2px solid var(--accent-color);
  pointer-events: none;
}

.crop-grid {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(to right, rgba(255,255,255,0.3) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.3) 1px, transparent 1px);
  background-size: 33.33% 33.33%;
}

.crop-handles .handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: white;
  border: 2px solid var(--accent-color);
  border-radius: 2px;
}

.handle.tl { top: -6px; left: -6px; }
.handle.tr { top: -6px; right: -6px; }
.handle.bl { bottom: -6px; left: -6px; }
.handle.br { bottom: -6px; right: -6px; }

/* Controls */
.crop-controls {
  padding: 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 2rem;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.group-label {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

.ratio-buttons {
  display: flex;
  gap: 0.5rem;
}

.ratio-buttons button {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.ratio-buttons button.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  transform: translateY(-2px);
}

.divider {
  width: 1px;
  height: 40px;
  background: var(--border-color);
}

.ml-auto { margin-left: auto; }

/* Buttons */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.875rem 1.5rem;
  border-radius: 14px;
  font-family: var(--font-heading);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: var(--accent-color);
  color: white;
  box-shadow: 0 4px 0px #15803D;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 0px #15803D;
}

.btn-secondary {
  background: var(--card-bg);
  color: var(--text-primary);
  border: 2px solid var(--border-color);
  box-shadow: 4px 4px 0px var(--border-color);
}

.btn-secondary:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0px var(--border-color);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

[data-theme="light"] .sidebar-card,
[data-theme="light"] .crop-container-card {
  box-shadow: 4px 4px 0px var(--border-color);
}
</style>
