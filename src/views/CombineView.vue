<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import { 
  Layers, X, Settings2, ArrowDown, ArrowRight, Grid3X3,
  Plus, Trash2, MoveLeft, MoveRight, Square, CheckSquare
} from 'lucide-vue-next'

const store = useImageStore()
const { triggerFileInput, handleFileChange } = useFileHelpers()

const combineDirection = ref<'vertical' | 'horizontal' | 'grid'>('vertical')
const spacing = ref(10)
const backgroundColor = ref('#FFFFFF')
const isProcessing = ref(false)

const handleCombine = async () => {
  isProcessing.value = true
  await new Promise(resolve => setTimeout(resolve, 2000))
  store.images.forEach(img => {
    store.updateImage(img.id, { status: 'done' })
  })
  isProcessing.value = false
}

const moveImage = (index: number, direction: 'prev' | 'next') => {
  const newImages = [...store.images]
  const targetIndex = direction === 'prev' ? index - 1 : index + 1
  if (targetIndex >= 0 && targetIndex < newImages.length) {
    const temp = newImages[index]!
    newImages[index] = newImages[targetIndex]!
    newImages[targetIndex] = temp
    store.images = newImages
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
        v-for="(img, index) in store.images" 
        :key="img.id" 
        :image="img"
        :is-selected="store.selectedIds.has(img.id)"
        @toggle="store.toggleSelection"
        @remove="store.removeImage"
      >
        <template #meta>
          <div class="card-order-actions">
            <button @click.stop="moveImage(index, 'prev')" :disabled="index === 0" class="order-btn">
              <MoveLeft :size="14" />
            </button>
            <button @click.stop="moveImage(index, 'next')" :disabled="index === store.images.length - 1" class="order-btn">
              <MoveRight :size="14" />
            </button>
          </div>
        </template>
      </ImageCard>
    </template>

    <template #sidebar>
      <div class="sidebar-content">
        <div class="panel-section">
          <div class="section-title">
            <Settings2 :size="18" /> 布局方向
          </div>
          <div class="direction-selector">
            <button :class="{ active: combineDirection === 'vertical' }" @click="combineDirection = 'vertical'">
              <ArrowDown :size="18" /><span>纵向</span>
            </button>
            <button :class="{ active: combineDirection === 'horizontal' }" @click="combineDirection = 'horizontal'">
              <ArrowRight :size="18" /><span>横向</span>
            </button>
            <button :class="{ active: combineDirection === 'grid' }" @click="combineDirection = 'grid'">
              <Grid3X3 :size="18" /><span>网格</span>
            </button>
          </div>
        </div>

        <div class="panel-section">
          <div class="section-title">
            <span>间距 (px)</span>
            <span class="val-badge">{{ spacing }}px</span>
          </div>
          <input type="range" v-model.number="spacing" min="0" max="100" class="pro-slider">
        </div>

        <div class="panel-section">
          <div class="section-title"><span>背景颜色</span></div>
          <div class="color-picker-group">
            <input type="color" v-model="backgroundColor" class="color-input">
            <input type="text" v-model="backgroundColor" class="color-text" placeholder="#FFFFFF">
          </div>
        </div>

        <div class="panel-footer">
          <AppButton size="lg" :loading="isProcessing" @click="handleCombine">
            <template #icon><Layers v-if="!isProcessing" :size="20" /></template>
            执行合并
          </AppButton>
          <p class="footer-hint">图片将按队列顺序拼合</p>
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

.direction-selector {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
  background: var(--bg-color);
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.direction-selector button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.6rem 0.25rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 700;
  font-size: 0.7rem;
  border-radius: 8px;
  cursor: pointer;
}

.direction-selector button.active {
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

.color-picker-group {
  display: flex;
  gap: 0.5rem;
}

.color-input {
  -webkit-appearance: none;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: none;
  cursor: pointer;
  padding: 0;
}

.color-input::-webkit-color-swatch { border-radius: 6px; border: none; }

.color-text {
  flex: 1;
  padding: 0 0.75rem;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: monospace;
  font-size: 0.8rem;
  outline: none;
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

.card-order-actions {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.order-btn {
  flex: 1;
  height: 24px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.order-btn:hover:not(:disabled) {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.order-btn:disabled {
  opacity: 0.3;
}
</style>
