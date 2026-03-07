<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import { 
  X, Download, Zap, Trash2, Settings2, Loader2, Plus, Square, CheckSquare
} from 'lucide-vue-next'

const store = useImageStore()
const { fileInput, triggerFileInput, handleFileChange, downloadImage } = useFileHelpers()

const resizeMode = ref<'pixels' | 'percentage'>('percentage')
const width = ref(1920)
const height = ref(1080)
const percentage = ref(50)
const maintainAspectRatio = ref(true)
const isProcessing = ref(false)

const handleResize = async () => {
  isProcessing.value = true
  // 模拟处理逻辑
  await new Promise(resolve => setTimeout(resolve, 1500))
  store.images.forEach(img => {
    store.updateImage(img.id, { status: 'done' })
  })
  isProcessing.value = false
}

const handleDownload = (id: string) => {
  const item = store.images.find(img => img.id === id)
  if (item?.processedBlob || item?.preview) {
    // 这里暂时使用预览图模拟，实际逻辑应根据处理后的 Blob
    fetch(item.preview).then(res => res.blob()).then(blob => {
      downloadImage(blob, item.file.name, 'resized_')
    })
  }
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
        @toggle="store.toggleSelection"
        @remove="store.removeImage"
        @download="handleDownload"
      />
    </template>

    <template #sidebar>
      <div class="sidebar-content">
        <div class="panel-section">
          <div class="section-title">
            <Settings2 :size="18" /> 调整模式
          </div>
          <div class="toggle-group">
            <button 
              :class="{ active: resizeMode === 'percentage' }" 
              @click="resizeMode = 'percentage'"
            >百分比</button>
            <button 
              :class="{ active: resizeMode === 'pixels' }" 
              @click="resizeMode = 'pixels'"
            >像素</button>
          </div>
        </div>

        <div class="panel-section" v-if="resizeMode === 'percentage'">
          <div class="section-title">
            <span>缩放比例</span>
            <span class="val-badge">{{ percentage }}%</span>
          </div>
          <div class="slider-container">
            <input type="range" v-model.number="percentage" min="1" max="200" step="1" class="pro-slider">
            <div class="slider-marks">
              <span>1%</span>
              <span>100%</span>
              <span>200%</span>
            </div>
          </div>
        </div>

        <div v-else class="panel-section">
          <div class="input-grid">
            <div class="input-field">
              <label>宽度 (px)</label>
              <input type="number" v-model.number="width">
            </div>
            <div class="input-field">
              <label>高度 (px)</label>
              <input type="number" v-model.number="height">
            </div>
          </div>
          <label class="checkbox-label">
            <input type="checkbox" v-model="maintainAspectRatio">
            <span class="checkbox-box"></span>
            锁定纵横比
          </label>
        </div>

        <div class="panel-section info-section">
          <div class="info-card">
            <Zap :size="16" />
            <p>处理后图片质量将保持在最高水平，采用 Lanczos 算法进行高质量缩放。</p>
          </div>
        </div>

        <div class="panel-footer">
          <AppButton size="lg" class="w-full" :loading="isProcessing" @click="handleResize">
            {{ isProcessing ? '正在处理...' : '执行调整' }}
          </AppButton>
          <p class="footer-hint">所有操作在浏览器本地完成</p>
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
  gap: 2rem;
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
  text-transform: uppercase;
}

.toggle-group {
  display: flex;
  background: var(--bg-color);
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.toggle-group button {
  flex: 1;
  padding: 0.6rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
}

.toggle-group button.active {
  background: var(--card-bg);
  color: var(--accent-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.val-badge {
  background: rgba(34, 197, 94, 0.1);
  color: var(--accent-color);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
}

.pro-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  background: var(--bg-color);
  border-radius: 3px;
  margin-bottom: 0.75rem;
}

.pro-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: var(--accent-color);
  border: 3px solid var(--card-bg);
  border-radius: 50%;
  cursor: pointer;
}

.slider-marks {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.input-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.input-field label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.input-field input {
  padding: 0.75rem;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-weight: 600;
  outline: none;
  width: 100%;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.checkbox-box {
  width: 18px;
  height: 18px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.info-card {
  background: rgba(34, 197, 94, 0.05);
  padding: 1rem;
  border-radius: 12px;
  display: flex;
  gap: 0.75rem;
  color: var(--text-secondary);
  font-size: 0.75rem;
  line-height: 1.4;
}

.info-card svg {
  color: var(--accent-color);
  flex-shrink: 0;
}

.panel-footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.w-full {
  width: 100%;
}

.footer-hint {
  text-align: center;
  font-size: 0.7rem;
  color: var(--text-secondary);
}
</style>
