<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import { 
  Grid3X3, X, Loader2, Settings2, Plus, Layout, Trash2, Square, CheckSquare
} from 'lucide-vue-next'

const store = useImageStore()
const { fileInput, triggerFileInput, handleFileChange } = useFileHelpers()

const cols = ref(3)
const gap = ref(10)
const padding = ref(20)
const borderRadius = ref(12)
const isProcessing = ref(false)

const handleGenerateGrid = async () => {
  isProcessing.value = true
  await new Promise(resolve => setTimeout(resolve, 1800))
  store.images.forEach(img => {
    store.updateImage(img.id, { status: 'done' })
  })
  isProcessing.value = false
}

const gridStyle = computed(() => {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols.value}, 1fr)`,
    gap: `${gap.value / 4}px`, 
    padding: `${padding.value / 4}px`,
    backgroundColor: 'var(--bg-color)'
  }
})
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
      />
    </template>

    <template #sidebar>
      <div class="sidebar-content">
        <div class="panel-section">
          <div class="section-title">
            <Layout :size="18" /> 布局预览
          </div>
          <div class="mini-grid-preview custom-scrollbar">
            <div class="grid-container" :style="gridStyle">
              <div 
                v-for="img in store.images.slice(0, 12)" 
                :key="img.id" 
                class="mini-box"
                :style="{ borderRadius: borderRadius/4 + 'px' }"
              >
                <img :src="img.preview" alt="">
              </div>
              <div v-if="store.images.length > 12" class="mini-box more">
                +{{ store.images.length - 12 }}
              </div>
            </div>
          </div>
        </div>

        <div class="panel-section">
          <div class="section-title">
            <Settings2 :size="18" /> 网格参数
          </div>
          <div class="adjust-list">
            <div class="adjust-item">
              <div class="adjust-label">列数 <span class="val">{{ cols }}</span></div>
              <input type="range" v-model.number="cols" min="1" max="6" class="pro-slider">
            </div>
            <div class="adjust-item">
              <div class="adjust-label">间距 <span class="val">{{ gap }}px</span></div>
              <input type="range" v-model.number="gap" min="0" max="100" class="pro-slider">
            </div>
            <div class="adjust-item">
              <div class="adjust-label">外边距 <span class="val">{{ padding }}px</span></div>
              <input type="range" v-model.number="padding" min="0" max="100" class="pro-slider">
            </div>
            <div class="adjust-item">
              <div class="adjust-label">图片圆角 <span class="val">{{ borderRadius }}px</span></div>
              <input type="range" v-model.number="borderRadius" min="0" max="50" class="pro-slider">
            </div>
          </div>
        </div>

        <div class="panel-footer">
          <AppButton size="lg" :loading="isProcessing" @click="handleGenerateGrid">
            <template #icon><Layout v-if="!isProcessing" :size="20" /></template>
            {{ isProcessing ? '正在生成...' : '生成拼图' }}
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

.mini-grid-preview {
  height: 140px;
  background: var(--bg-color);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: auto;
  padding: 0.5rem;
}

.grid-container {
  min-height: 100%;
}

.mini-box {
  background: var(--card-bg);
  aspect-ratio: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
}

.mini-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mini-box.more {
  background: var(--accent-color);
  color: white;
  font-size: 0.6rem;
  font-weight: 800;
}

.adjust-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.adjust-item {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.adjust-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.adjust-label .val {
  margin-left: auto;
  color: var(--accent-color);
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
</style>
