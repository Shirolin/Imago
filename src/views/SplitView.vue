<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import ImageUpload from '../components/common/ImageUpload.vue'
import { 
  Split, X, Download, Loader2, Trash2, 
  Settings2, Grid3X3, LayoutGrid, Square,
  Scissors, CheckSquare, Plus, CheckCircle2
} from 'lucide-vue-next'

const store = useImageStore()
const splitMode = ref<'grid' | 'tiles'>('grid')
const rows = ref(3)
const cols = ref(3)
const tileWidth = ref(1080)
const tileHeight = ref(1080)
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

const handleSplit = async () => {
  isProcessing.value = true
  // 模拟处理逻辑
  await new Promise(resolve => setTimeout(resolve, 1500))
  store.images.forEach(img => {
    if (store.selectedIds.size === 0 || store.selectedIds.has(img.id)) {
      store.updateImage(img.id, { status: 'done' })
    }
  })
  isProcessing.value = false
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
              :class="[img.status, { selected: store.selectedIds.has(img.id) }]"
              @click="store.toggleSelection(img.id)"
            >
              <div class="card-selection" :class="{ active: store.selectedIds.has(img.id) }">
                <CheckSquare v-if="store.selectedIds.has(img.id)" :size="18" />
                <Square v-else :size="18" />
              </div>

              <div class="card-preview">
                <img :src="img.preview" alt="Preview">
                
                <!-- Overlay grid based on settings -->
                <div v-if="splitMode === 'grid'" class="grid-overlay" 
                     :style="{ gridTemplateRows: `repeat(${rows}, 1fr)`, gridTemplateColumns: `repeat(${cols}, 1fr)` }">
                  <div v-for="n in (rows * cols)" :key="n" class="grid-cell"></div>
                </div>

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
                    <span>{{ img.status === 'done' ? '分割完成' : (img.status === 'error' ? '失败' : '等待处理') }}</span>
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
      <aside class="control-panel">
        <div class="panel-section">
          <div class="section-title">
            <Settings2 :size="18" /> 分割模式
          </div>
          <div class="toggle-group">
            <button 
              :class="{ active: splitMode === 'grid' }" 
              @click="splitMode = 'grid'"
            >网格</button>
            <button 
              :class="{ active: splitMode === 'tiles' }" 
              @click="splitMode = 'tiles'"
            >瓦片</button>
          </div>
        </div>

        <div v-if="splitMode === 'grid'" class="panel-section">
          <div class="input-grid">
            <div class="input-field">
              <label>行数 (Rows)</label>
              <input type="number" v-model.number="rows" min="1" max="10">
            </div>
            <div class="input-field">
              <label>列数 (Cols)</label>
              <input type="number" v-model.number="cols" min="1" max="10">
            </div>
          </div>
          <p class="section-hint">将生成 {{ rows * cols }} 张图片</p>
        </div>

        <div v-else class="panel-section">
          <div class="input-grid">
            <div class="input-field">
              <label>瓦片宽度 (px)</label>
              <input type="number" v-model.number="tileWidth" min="1">
            </div>
            <div class="input-field">
              <label>瓦片高度 (px)</label>
              <input type="number" v-model.number="tileHeight" min="1">
            </div>
          </div>
        </div>

        <div class="panel-section info-section">
          <div class="info-card">
            <Scissors :size="16" />
            <p>分割后的图片将自动打包为 ZIP 文件下载。处理极大图片时可能需要较多内存。</p>
          </div>
        </div>

        <div class="panel-footer">
          <button @click="handleSplit" class="btn-apply" :disabled="isProcessing">
            <Loader2 v-if="isProcessing" class="spin" :size="18" />
            <Scissors v-else :size="18" />
            {{ isProcessing ? '正在处理...' : '执行分割' }}
          </button>
          <p class="footer-hint">所有操作在浏览器本地完成</p>
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

.grid-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  border: 1px solid rgba(34, 197, 94, 0.5);
  pointer-events: none;
}

.grid-cell {
  border: 1px solid rgba(34, 197, 94, 0.3);
  box-shadow: inset 0 0 10px rgba(34, 197, 94, 0.1);
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

.toggle-group {
  display: flex;
  background: var(--bg-color);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.toggle-group button {
  flex: 1;
  padding: 0.75rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 700;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-group button.active {
  background: var(--card-bg);
  color: var(--accent-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.section-hint {
  font-size: 0.75rem;
  color: var(--accent-color);
  font-weight: 700;
  text-align: center;
  margin-top: 1rem;
}

.input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.input-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-field label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.input-field input {
  padding: 0.875rem;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  color: var(--text-primary);
  font-family: var(--font-heading);
  font-weight: 700;
  outline: none;
}

.input-field input:focus {
  border-color: var(--accent-color);
}

.info-card {
  background: rgba(34, 197, 94, 0.05);
  border: 1px solid rgba(34, 197, 94, 0.1);
  padding: 1.25rem;
  border-radius: 16px;
  display: flex;
  gap: 1rem;
  color: var(--text-secondary);
  font-size: 0.8rem;
  line-height: 1.5;
}

.info-card svg {
  color: var(--accent-color);
  flex-shrink: 0;
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
