<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import { 
  Trash2, X, Loader2, Info, MapPin, Camera, Calendar, HardDrive,
  ShieldCheck, ShieldAlert, Zap, Plus, Square, CheckSquare
} from 'lucide-vue-next'

const store = useImageStore()
const { fileInput, triggerFileInput, handleFileChange } = useFileHelpers()

const selectedImageId = ref<string | null>(null)
const isProcessing = ref(false)

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

const handleClearExif = async () => {
  isProcessing.value = true
  await new Promise(resolve => setTimeout(resolve, 1200))
  isProcessing.value = false
  alert('EXIF 信息已成功清除 (模拟)')
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
      <div class="exif-workspace">
        <div class="main-display-card">
          <div class="image-selector-strip custom-scrollbar">
            <div 
              v-for="img in store.images" 
              :key="img.id" 
              class="strip-item"
              :class="{ active: selectedImage?.id === img.id, selected: store.selectedIds.has(img.id) }"
              @click="selectedImageId = img.id"
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
                <ShieldAlert :size="20" class="text-error" />
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
          <AppButton size="lg" :loading="isProcessing" @click="handleClearExif">
            <template #icon><Trash2 v-if="!isProcessing" :size="20" /></template>
            清除所有选定图片的元数据
          </AppButton>
        </div>
      </div>
    </template>

    <template #sidebar>
      <div class="sidebar-content">
        <div class="panel-section">
          <div class="section-title">
            <Info :size="18" /> 元数据详情
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
          </div>
          
          <div v-else class="empty-selection">
            <p>请选择一张图片查看详情</p>
          </div>
        </div>
        
        <div class="info-card mt-auto">
          <h3>关于 EXIF</h3>
          <p>EXIF 是交换图像文件格式。它包含相机设置、GPS 坐标和拍摄时间。清除这些信息有助于保护您的隐私。</p>
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

.text-error { color: #EF4444; }

.exif-workspace {
  grid-column: 1 / -1;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.main-display-card {
  flex: 1;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.image-selector-strip {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-color);
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
}

.strip-item {
  width: 60px;
  height: 60px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
  position: relative;
}

.strip-item.active {
  border-color: var(--accent-color);
  transform: scale(1.05);
}

.strip-item-selection {
  position: absolute;
  top: 3px;
  left: 3px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background-image: radial-gradient(var(--border-color) 1px, transparent 1px);
  background-size: 24px 24px;
}

.display-inner {
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.display-inner img {
  max-width: 100%;
  max-height: 400px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.privacy-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 99px;
  font-weight: 700;
  font-size: 0.8rem;
}

.action-footer {
  margin-top: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.security-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

/* Sidebar Styles */
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
  gap: 0.5rem;
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.metadata-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.meta-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-color);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.meta-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--card-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-color);
  flex-shrink: 0;
}

.meta-content label {
  display: block;
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 0.1rem;
}

.meta-content p {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.info-card {
  background: rgba(34, 197, 94, 0.05);
  padding: 1rem;
  border-radius: 12px;
  border: 1px dashed var(--accent-color);
}

.info-card h3 {
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 0.4rem;
}

.info-card p {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.mt-auto { margin-top: auto; }
</style>
