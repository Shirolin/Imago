<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import { 
  Scissors, X, Loader2, RotateCw, FlipHorizontal, FlipVertical,
  RefreshCcw, Check, Plus, Trash2, Square, CheckSquare
} from 'lucide-vue-next'

const store = useImageStore()
const { fileInput, triggerFileInput, handleFileChange } = useFileHelpers()

const selectedImageId = ref<string | null>(null)
const isProcessing = ref(false)

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

const handleCrop = async () => {
  isProcessing.value = true
  await new Promise(resolve => setTimeout(resolve, 1000))
  isProcessing.value = false
  alert('裁剪功能逻辑待接入')
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
      <!-- 裁剪页面使用特殊的布局：左侧列表，中间大图 -->
      <div class="crop-workspace">
        <div class="crop-viewport-card">
          <div class="crop-viewport">
            <div v-if="selectedImage" class="preview-stage">
              <img :src="selectedImage.preview" alt="Crop Preview" class="main-crop-img">
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
          
          <div class="crop-toolbar">
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
              <AppButton :loading="isProcessing" @click="handleCrop">
                <template #icon><Check v-if="!isProcessing" :size="20" /></template>
                应用裁剪
              </AppButton>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #sidebar>
      <div class="sidebar-header">
        <h2>待处理队列</h2>
      </div>
      <div class="sidebar-list custom-scrollbar">
        <div 
          v-for="img in store.images" 
          :key="img.id" 
          class="list-item"
          :class="{ active: selectedImage?.id === img.id, selected: store.selectedIds.has(img.id) }"
          @click="selectedImageId = img.id"
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
          </div>
          <button @click.stop="store.removeImage(img.id)" class="item-remove">
            <X :size="14" />
          </button>
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

/* 裁剪专用布局 */
.crop-workspace {
  grid-column: 1 / -1;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.crop-viewport-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.crop-viewport {
  flex: 1;
  background: var(--bg-color);
  margin: 1rem;
  border-radius: 12px;
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
}

.crop-grid {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px);
  background-size: 33.33% 33.33%;
}

.crop-handles .handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: white;
  border: 2px solid var(--accent-color);
  border-radius: 2px;
}

.handle.tl { top: -5px; left: -5px; }
.handle.tr { top: -5px; right: -5px; }
.handle.bl { bottom: -5px; left: -5px; }
.handle.br { bottom: -5px; right: -5px; }

.crop-toolbar {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.group-label {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.ratio-buttons {
  display: flex;
  gap: 0.4rem;
}

.ratio-buttons button {
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-primary);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.ratio-buttons button.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.action-buttons {
  display: flex;
  gap: 0.4rem;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.divider {
  width: 1px;
  height: 32px;
  background: var(--border-color);
}

.ml-auto { margin-left: auto; }

/* Sidebar Styles */
.sidebar-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-header h2 {
  font-size: 0.9rem;
  font-weight: 700;
}

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem;
  border-radius: 12px;
  cursor: pointer;
  border: 2px solid transparent;
  margin-bottom: 0.4rem;
}

.list-item:hover { background: var(--hover-bg); }
.list-item.active { border-color: var(--accent-color); background: rgba(34, 197, 94, 0.05); }

.item-selection { color: var(--text-secondary); display: flex; }
.item-selection .checked { color: var(--accent-color); }

.item-preview {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--bg-color);
  overflow: hidden;
  flex-shrink: 0;
}

.item-preview img { width: 100%; height: 100%; object-fit: cover; }

.item-info { flex: 1; min-width: 0; }
.item-name { font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.item-remove {
  width: 20px; height: 20px; border-radius: 4px; border: none;
  background: transparent; color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; opacity: 0;
}

.list-item:hover .item-remove { opacity: 1; }
.item-remove:hover { background: #EF4444; color: white; }
</style>
