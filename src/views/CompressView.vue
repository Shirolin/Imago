<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import ImageUpload from '../components/common/ImageUpload.vue'
import imageCompression from 'browser-image-compression'
import { Download, X, AlertCircle, CheckCircle2, Loader2, Zap, Trash2, ArrowRight, Plus, Square, CheckSquare } from 'lucide-vue-next'

const store = useImageStore()
const compressionQuality = ref(0.8)
const isCompressing = ref(false)
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

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const compressImage = async (id: string) => {
  const item = store.images.find(img => img.id === id)
  if (!item) return

  store.updateImage(id, { status: 'processing' })
  
  try {
    const options = {
      maxSizeMB: 10,
      maxWidthOrHeight: 4096,
      useWebWorker: true,
      initialQuality: compressionQuality.value
    }
    
    const compressedFile = await imageCompression(item.file, options)
    store.updateImage(id, {
      status: 'done',
      processedSize: compressedFile.size,
      processedBlob: compressedFile
    })
  } catch (error) {
    console.error('Compression failed:', error)
    store.updateImage(id, { status: 'error', error: '压缩失败' })
  }
}

const compressAll = async () => {
  isCompressing.value = true
  const idleImages = store.images.filter(img => img.status !== 'done')
  await Promise.all(idleImages.map(img => compressImage(img.id)))
  isCompressing.value = false
}

const downloadImage = (id: string) => {
  const item = store.images.find(img => img.id === id)
  if (!item?.processedBlob) return
  
  const url = URL.createObjectURL(item.processedBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = `compressed_${item.file.name}`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="view-container">
    <div v-if="store.images.length === 0" class="empty-state">
      <ImageUpload @upload="store.addImages" />
    </div>
    
    <div v-else class="workspace">
      <header class="workspace-header">
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
          <div class="divider"></div>
          <div class="compression-settings">
            <div class="control-label">
              <span>压缩质量</span>
              <span class="value">{{ Math.round(compressionQuality * 100) }}%</span>
            </div>
            <input type="range" v-model.number="compressionQuality" min="0.1" max="1.0" step="0.05" class="custom-range">
          </div>
        </div>

        <div class="header-actions">
          <input type="file" ref="fileInput" multiple accept="image/*" @change="onFileChange" style="display: none">
          <button @click="triggerFileInput" class="btn btn-secondary">
            <Plus :size="18" /> 添加图片
          </button>
          <button @click="store.removeSelected" class="btn btn-secondary" :disabled="!store.selectedCount">
            <Trash2 :size="18" /> 删除选中
          </button>
          <button @click="store.clearImages" class="btn btn-secondary">
            <X :size="18" /> 清空全部
          </button>
          <div class="divider"></div>
          <button @click="compressAll" class="btn btn-primary" :disabled="isCompressing">
            <Loader2 v-if="isCompressing" class="spin" :size="18" />
            <Zap v-else :size="18" />
            全部压缩
          </button>
        </div>
      </header>

      <div class="image-grid-wrapper">
        <div class="image-grid custom-scrollbar">
          <div 
            v-for="img in store.images" 
            :key="img.id" 
            class="image-card" 
            :class="[img.status, { selected: store.selectedIds.has(img.id) }]"
            @click="store.toggleSelection(img.id)"
          >
            <div class="card-selection" :class="{ active: store.selectedIds.has(img.id) }">
              <CheckSquare v-if="store.selectedIds.has(img.id)" :size="18" />
              <Square v-else :size="18" />
            </div>

            <div class="card-preview">
              <img :src="img.preview" alt="Preview">
              
              <div v-if="img.status === 'processing'" class="processing-overlay">
                <div class="loader-ring"></div>
                <span class="loading-text">压缩中...</span>
              </div>
              
              <div v-if="img.status === 'done'" class="success-badge">
                <Zap :size="12" /> 节省 {{ Math.round((1 - img.processedSize! / img.originalSize) * 100) }}%
              </div>
            </div>

            <div class="card-body">
              <div class="card-top">
                <span class="filename" :title="img.file.name">{{ img.file.name }}</span>
                <button @click.stop="store.removeImage(img.id)" class="close-btn">
                  <X :size="14" />
                </button>
              </div>
              
              <div class="comparison-grid">
                <div class="size-box original">
                  <span class="label">原始体积</span>
                  <span class="val">{{ formatSize(img.originalSize) }}</span>
                </div>
                <div class="size-arrow">
                  <ArrowRight :size="14" />
                </div>
                <div class="size-box compressed" :class="{ active: img.status === 'done' }">
                  <span class="label">压缩后</span>
                  <span class="val">{{ img.status === 'done' ? formatSize(img.processedSize!) : '--' }}</span>
                </div>
              </div>

              <div class="card-actions">
                <div class="status-pill" :class="img.status">
                  <div class="pulse-dot"></div>
                  <span>{{ img.status === 'done' ? '已完成' : (img.status === 'error' ? '失败' : '准备就绪') }}</span>
                </div>
                <button 
                  v-if="img.status === 'done'" 
                  @click.stop="downloadImage(img.id)" 
                  class="download-pill"
                >
                  <Download :size="16" /> 下载
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  padding: 2rem 3rem;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.empty-state {
  max-width: 900px;
  margin: auto;
  width: 100%;
}

.workspace {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  height: 100%;
  overflow: hidden;
}

.workspace-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--card-bg);
  padding: 1.5rem 2rem;
  border-radius: 24px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 0 var(--border-color);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.select-control {
  display: flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 12px;
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
  font-size: 1.1rem;
  font-family: var(--font-heading);
}

.selection-info .label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
}

.compression-settings {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 180px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.control-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.control-label .value {
  color: var(--accent-color);
}

.custom-range {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  background: var(--bg-color);
  border-radius: 3px;
  outline: none;
}

.custom-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: var(--accent-color);
  border-radius: 50%;
  cursor: pointer;
}

.divider {
  width: 1px;
  height: 40px;
  background: var(--border-color);
}

.btn {
  padding: 0.75rem 1.25rem;
  border-radius: 12px;
  font-family: var(--font-heading);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-size: 0.9rem;
}

.btn-primary {
  background: var(--accent-color);
  color: #FFFFFF;
  box-shadow: 0 4px 0 #15803d;
}

.btn-secondary {
  background: var(--bg-color);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 0 var(--border-color);
}

.btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.btn:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Image Grid */
.image-grid-wrapper {
  flex: 1;
  overflow: hidden;
  padding-top: 1rem;
  margin-top: -1rem;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2rem;
  height: 100%;
  padding: 1rem 0.5rem 2rem 0;
  margin-top: -1rem;
}

.image-card {
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 24px;
  overflow: hidden;
  transition: all 0.3s;
  position: relative;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}

.image-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.1);
}

.image-card.selected {
  border-color: var(--accent-color);
  background: rgba(34, 197, 94, 0.02);
}

.card-selection {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 10;
  color: var(--text-secondary);
  background: var(--card-bg);
  border-radius: 8px;
  padding: 4px;
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  flex-shrink: 0;
}

.card-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.processing-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--accent-color);
}

.loader-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  font-weight: 700;
  font-size: 0.9rem;
}

.card-body {
  padding: 1rem 1.25rem 1.25rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.filename {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80%;
}

.close-btn {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #fee2e2;
  color: #ef4444;
  border-color: #fecaca;
}

/* New Card Styles */
.success-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: var(--accent-color);
  color: white;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
  z-index: 5;
  animation: slide-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes slide-in {
  from { transform: translateX(20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.loader-ring {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: 0.75rem;
  font-weight: 700;
  margin-top: 0.5rem;
  color: white;
}

.comparison-grid {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-color);
  padding: 0.75rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  border: 1px solid var(--border-color);
}

.size-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.size-box .label {
  font-size: 0.55rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

.size-box .val {
  font-family: var(--font-heading);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.size-box.compressed.active .val {
  color: var(--accent-color);
}

.size-arrow {
  color: var(--border-color);
  display: flex;
}

.card-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 6px 12px;
  background: var(--bg-color);
  border-radius: 99px;
  border: 1px solid var(--border-color);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.status-pill.done {
  color: var(--accent-color);
  border-color: rgba(34, 197, 94, 0.2);
  background: rgba(34, 197, 94, 0.05);
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background: var(--border-color);
  border-radius: 50%;
}

.status-pill.done .pulse-dot {
  background: var(--accent-color);
  box-shadow: 0 0 8px var(--accent-color);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}

.download-pill {
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 99px;
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  box-shadow: 0 4px 0 #15803d;
  transition: all 0.2s;
}

.download-pill:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 0 #15803d;
}

.download-pill:active {
  transform: translateY(1px);
  box-shadow: 0 1px 0 #15803d;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
