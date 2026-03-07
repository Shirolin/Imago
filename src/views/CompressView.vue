<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import imageCompression from 'browser-image-compression'
import { 
  Download, X, Loader2, Zap, Plus, Trash2, ArrowRight, Square, CheckSquare 
} from 'lucide-vue-next'

const store = useImageStore()
const { fileInput, formatSize, triggerFileInput, handleFileChange, downloadImage } = useFileHelpers()

const compressionQuality = ref(0.8)
const isCompressing = ref(false)

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

const handleDownload = (id: string) => {
  const item = store.images.find(img => img.id === id)
  if (item?.processedBlob) {
    downloadImage(item.processedBlob, item.file.name, 'compressed_')
  }
}
</script>

<template>
  <WorkspaceLayout>
    <template #header-left>
      <div class="header-left-content">
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
        <div class="vertical-divider"></div>
        <div class="compression-settings">
          <div class="control-label">
            <span>压缩质量</span>
            <span class="value">{{ Math.round(compressionQuality * 100) }}%</span>
          </div>
          <input type="range" v-model.number="compressionQuality" min="0.1" max="1.0" step="0.05" class="custom-range">
        </div>
      </div>
    </template>

    <template #header-actions>
      <input type="file" ref="fileInput" multiple accept="image/*" @change="handleFileChange" style="display: none">
      <AppButton variant="secondary" @click="triggerFileInput">
        <template #icon><Plus :size="18" /></template>
        添加图片
      </AppButton>
      <AppButton variant="secondary" :disabled="!store.selectedCount" @click="store.removeSelected">
        <template #icon><Trash2 :size="18" /></template>
        删除选中
      </AppButton>
      <AppButton variant="secondary" @click="store.clearImages">
        <template #icon><X :size="18" /></template>
        清空全部
      </AppButton>
      <div class="vertical-divider"></div>
      <AppButton :loading="isCompressing" @click="compressAll">
        <template #icon>
          <Loader2 v-if="isCompressing" class="spin" :size="18" />
          <Zap v-else :size="18" />
        </template>
        全部压缩
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
      >
        <template #overlay="{ image }">
          <div v-if="image.status === 'done'" class="success-badge">
            <Zap :size="12" /> 节省 {{ Math.round((1 - image.processedSize! / image.originalSize) * 100) }}%
          </div>
        </template>

        <template #meta="{ image }">
          <div class="comparison-grid">
            <div class="size-box original">
              <span class="label">原始</span>
              <span class="val">{{ formatSize(image.originalSize) }}</span>
            </div>
            <div class="size-arrow">
              <ArrowRight :size="14" />
            </div>
            <div class="size-box compressed" :class="{ active: image.status === 'done' }">
              <span class="label">压缩后</span>
              <span class="val">{{ image.status === 'done' ? formatSize(image.processedSize!) : '--' }}</span>
            </div>
          </div>
        </template>
      </ImageCard>
    </template>
  </WorkspaceLayout>
</template>

<style scoped>
.header-left-content {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.select-control {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 12px;
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

.vertical-divider {
  width: 1px;
  height: 32px;
  background: var(--border-color);
}

.compression-settings {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 160px;
}

.control-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
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
  height: 4px;
  background: var(--bg-color);
  border-radius: 2px;
  outline: none;
}

.custom-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent-color);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--card-bg);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* 压缩页面特有的比较网格 */
.comparison-grid {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-color);
  padding: 0.6rem;
  border-radius: 10px;
  margin-top: 0.5rem;
  border: 1px solid var(--border-color);
}

.size-box {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.size-box .label {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.size-box .val {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.size-box.compressed.active .val {
  color: var(--accent-color);
}

.size-arrow {
  color: var(--text-secondary);
  opacity: 0.5;
  display: flex;
}

.success-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: var(--accent-color);
  color: white;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
  z-index: 5;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
