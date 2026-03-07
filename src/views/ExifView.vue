<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import ImageUpload from '../components/common/ImageUpload.vue'
import { 
  Trash2, X, Download, Loader2, Info, 
  MapPin, Camera, Calendar, HardDrive,
  Eye, EyeOff, ShieldCheck, ShieldAlert,
  Zap, Plus, Square, CheckSquare
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

// Mock EXIF data
const mockExif = {
  make: 'Apple',
  model: 'iPhone 15 Pro',
  date: '2024-03-15 14:22:05',
  location: '31.2304° N, 121.4737° E (Shanghai)',
  settings: 'f/1.78, 1/120s, ISO 100',
  lens: '24mm (Main)',
  software: 'iOS 17.4'
}

const selectImage = (id: string) => {
  selectedImageId.value = id
}

const handleClearExif = async () => {
  isProcessing.value = true
  await new Promise(resolve => setTimeout(resolve, 1200))
  isProcessing.value = false
  alert('EXIF 信息已成功清除 (模拟)')
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
        <h1 class="hero-title">隐私与元数据</h1>
        <p class="hero-subtitle">查看并清除图片中隐藏的 EXIF 信息，保护您的拍摄隐私。</p>
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
        <!-- Main: Selection & Preview -->
        <main class="exif-main">
          <div class="main-card">
            <div class="image-selector-strip custom-scrollbar">
              <div 
                v-for="img in store.images" 
                :key="img.id" 
                class="strip-item"
                :class="{ active: selectedImage?.id === img.id, selected: store.selectedIds.has(img.id) }"
                @click="selectImage(img.id)"
              >
                <div class="strip-item-selection" @click.stop="store.toggleSelection(img.id)">
                  <CheckSquare v-if="store.selectedIds.has(img.id)" :size="14" class="checked" />
                  <Square v-else :size="14" />
                </div>
                <img :src="img.preview" alt="">
              </div>
            </div>
            
            <div class="preview-display">
              <div v-if="selectedImage" class="display-inner">
                <img :src="selectedImage.preview" alt="Selected Preview">
                <div class="privacy-status">
                  <ShieldAlert v-if="true" :size="20" class="text-error" />
                  <ShieldCheck v-else :size="20" class="text-success" />
                  <span>含有 12 项元数据</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="action-footer">
            <div class="security-info">
              <Zap :size="16" />
              <span>所有操作仅在浏览器内完成，您的原始图片不会离开本地。</span>
            </div>
            <button @click="handleClearExif" class="btn btn-primary btn-lg" :disabled="isProcessing">
              <Loader2 v-if="isProcessing" :size="20" class="animate-spin" />
              <Trash2 v-else :size="20" />
              <span>清除所有选定图片的元数据</span>
            </button>
          </div>
        </main>

        <!-- Sidebar: Meta Data Details -->
        <aside class="metadata-sidebar">
          <div class="panel-card metadata-card">
            <div class="panel-header">
              <Info :size="20" />
              <h2>元数据详情</h2>
            </div>
            
            <div v-if="selectedImage" class="metadata-list">
              <div class="meta-item">
                <div class="meta-icon"><Camera :size="16" /></div>
                <div class="meta-content">
                  <label>相机型号</label>
                  <p>{{ mockExif.make }} {{ mockExif.model }}</p>
                </div>
              </div>

              <div class="meta-item">
                <div class="meta-icon"><Calendar :size="16" /></div>
                <div class="meta-content">
                  <label>拍摄时间</label>
                  <p>{{ mockExif.date }}</p>
                </div>
              </div>

              <div class="meta-item">
                <div class="meta-icon"><MapPin :size="16" /></div>
                <div class="meta-content">
                  <label>地理位置</label>
                  <p>{{ mockExif.location }}</p>
                </div>
              </div>

              <div class="meta-item">
                <div class="meta-icon"><Zap :size="16" /></div>
                <div class="meta-content">
                  <label>曝光设置</label>
                  <p>{{ mockExif.settings }}</p>
                </div>
              </div>

              <div class="meta-item">
                <div class="meta-icon"><HardDrive :size="16" /></div>
                <div class="meta-content">
                  <label>软件/固件</label>
                  <p>{{ mockExif.software }}</p>
                </div>
              </div>
            </div>
            
            <div v-else class="empty-selection">
              <p>请选择一张图片查看详情</p>
            </div>
          </div>
          
          <div class="panel-card info-card mt-4">
            <h3>关于 EXIF</h3>
            <p>EXIF 是交换图像文件格式。它包含相机设置、GPS 坐标和拍摄时间。清除这些信息有助于保护您的隐私。</p>
          </div>
        </aside>
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

.text-error { color: #EF4444; }
.text-success { color: #22C55E; }

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
  grid-template-columns: 1fr 340px;
  gap: 2rem;
  align-items: start;
}

/* Main Display Card */
.main-card {
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 4px 4px 0px var(--border-color);
  display: flex;
  flex-direction: column;
}

.image-selector-strip {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-color);
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
}

.strip-item {
  width: 70px;
  height: 70px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
  position: relative;
}

.strip-item:hover {
  transform: translateY(-2px);
}

.strip-item.active {
  border-color: var(--accent-color);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
}

.strip-item.selected {
  background: rgba(34, 197, 94, 0.1);
}

.strip-item-selection {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 5;
  background: var(--card-bg);
  border-radius: 4px;
  padding: 1px;
  display: flex;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.strip-item-selection .checked {
  color: var(--accent-color);
}

.strip-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-display {
  flex: 1;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  position: relative;
  background-image: radial-gradient(var(--border-color) 1px, transparent 1px);
  background-size: 24px 24px;
}

.display-inner {
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.display-inner img {
  max-width: 100%;
  max-height: 500px;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.privacy-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 99px;
  font-weight: 700;
  font-size: 0.9rem;
}

/* Action Footer */
.action-footer {
  margin-top: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.security-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
}

/* Metadata Sidebar */
.panel-card {
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: 6px 6px 0px var(--border-color);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.panel-header h2 {
  font-family: var(--font-heading);
  font-size: 1.1rem;
  font-weight: 700;
}

.metadata-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.meta-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-color);
  border-radius: 16px;
  border: 1px solid var(--border-color);
}

.meta-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--card-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-color);
  flex-shrink: 0;
  border: 1px solid var(--border-color);
}

.meta-content label {
  display: block;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
  margin-bottom: 0.15rem;
}

.meta-content p {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-all;
}

.info-card {
  background: rgba(34, 197, 94, 0.05);
  border-style: dashed;
}

.info-card h3 {
  font-family: var(--font-heading);
  font-size: 0.9rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.info-card p {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

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

.btn-lg {
  padding: 1rem 2rem;
  font-size: 1.1rem;
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

.mt-4 { margin-top: 1rem; }

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

[data-theme="light"] .main-card,
[data-theme="light"] .panel-card {
  box-shadow: 4px 4px 0px var(--border-color);
}
</style>
