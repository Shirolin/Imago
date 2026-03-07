<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import { 
  Split, X, Loader2, Settings2, Scissors, Plus, Trash2, Square, CheckSquare
} from 'lucide-vue-next'

const store = useImageStore()
const { fileInput, triggerFileInput, handleFileChange } = useFileHelpers()

const splitMode = ref<'grid' | 'tiles'>('grid')
const rows = ref(3)
const cols = ref(3)
const tileWidth = ref(1080)
const tileHeight = ref(1080)
const isProcessing = ref(false)

const handleSplit = async () => {
  isProcessing.value = true
  await new Promise(resolve => setTimeout(resolve, 1500))
  store.images.forEach(img => {
    if (store.selectedIds.size === 0 || store.selectedIds.has(img.id)) {
      store.updateImage(img.id, { status: 'done' })
    }
  })
  isProcessing.value = false
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
      >
        <template #overlay>
          <!-- 预览网格线 -->
          <div v-if="splitMode === 'grid'" class="grid-overlay" 
               :style="{ gridTemplateRows: `repeat(${rows}, 1fr)`, gridTemplateColumns: `repeat(${cols}, 1fr)` }">
            <div v-for="n in (rows * cols)" :key="n" class="grid-cell"></div>
          </div>
        </template>
      </ImageCard>
    </template>

    <template #sidebar>
      <div class="sidebar-content">
        <div class="panel-section">
          <div class="section-title"><Settings2 :size="18" /> 分割模式</div>
          <div class="toggle-group">
            <button :class="{ active: splitMode === 'grid' }" @click="splitMode = 'grid'">网格</button>
            <button :class="{ active: splitMode === 'tiles' }" @click="splitMode = 'tiles'">瓦片</button>
          </div>
        </div>

        <div v-if="splitMode === 'grid'" class="panel-section">
          <div class="input-grid">
            <div class="input-field">
              <label>行数</label>
              <input type="number" v-model.number="rows" min="1" max="10">
            </div>
            <div class="input-field">
              <label>列数</label>
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

        <div class="panel-footer">
          <AppButton size="lg" :loading="isProcessing" @click="handleSplit">
            <template #icon><Scissors v-if="!isProcessing" :size="20" /></template>
            执行分割
          </AppButton>
          <p class="footer-hint">分割后将自动打包为 ZIP</p>
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
  gap: 0.5rem;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
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
  font-weight: 700;
  font-size: 0.8rem;
  border-radius: 8px;
  cursor: pointer;
}

.toggle-group button.active {
  background: var(--card-bg);
  color: var(--accent-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
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
  font-weight: 700;
  outline: none;
}

.section-hint {
  font-size: 0.7rem;
  color: var(--accent-color);
  font-weight: 700;
  text-align: center;
  margin-top: 0.75rem;
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

.grid-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  border: 1px solid rgba(34, 197, 94, 0.5);
  pointer-events: none;
}

.grid-cell {
  border: 1px solid rgba(34, 197, 94, 0.3);
}
</style>
