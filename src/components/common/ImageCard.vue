<script setup lang="ts">
import { Download, X, Loader2, CheckCircle2, Square, CheckSquare } from 'lucide-vue-next'
import { useFileHelpers } from '../../composables/useFileHelpers'
import type { ImageItem } from '../../stores/imageStore'

const { formatSize } = useFileHelpers()

interface Props {
  image: ImageItem
  isSelected?: boolean
}

defineProps<Props>()
const emit = defineEmits(['toggle', 'remove', 'download'])
</script>

<template>
  <div 
    class="image-card" 
    :class="[image.status, { selected: isSelected }]"
    @click="emit('toggle', image.id)"
  >
    <!-- 选择框 -->
    <div class="card-selection" :class="{ active: isSelected }">
      <CheckSquare v-if="isSelected" :size="18" />
      <Square v-else :size="18" />
    </div>

    <!-- 预览图区域 -->
    <div class="card-preview">
      <img :src="image.preview" alt="Preview">
      
      <!-- 加载中 -->
      <div v-if="image.status === 'processing'" class="status-overlay">
        <Loader2 class="spin" :size="24" />
      </div>

      <!-- 完成标识 (默认) -->
      <div v-if="image.status === 'done'" class="success-indicator">
        <CheckCircle2 :size="16" />
      </div>

      <!-- 特定功能的插槽 (如压缩率) -->
      <slot name="overlay" :image="image"></slot>
    </div>

    <!-- 元数据 -->
    <div class="card-meta">
      <div class="meta-top">
        <span class="name" :title="image.file.name">{{ image.file.name }}</span>
        <span class="size">{{ formatSize(image.originalSize) }}</span>
      </div>

      <div class="status-row">
        <div class="status-pill" :class="image.status">
          <div class="pulse-dot"></div>
          <span>
            {{ 
              image.status === 'done' ? '处理完成' : 
              image.status === 'error' ? (image.error || '失败') : 
              image.status === 'processing' ? '处理中...' : '等待处理' 
            }}
          </span>
        </div>
        
        <button 
          v-if="image.status === 'done'" 
          class="mini-download" 
          @click.stop="emit('download', image.id)"
        >
          <Download :size="14" />
        </button>
      </div>

      <!-- 特定功能的元数据插槽 -->
      <slot name="meta" :image="image"></slot>
    </div>

    <!-- 删除按钮 -->
    <button @click.stop="emit('remove', image.id)" class="remove-btn">
      <X :size="14" />
    </button>
  </div>
</template>

<style scoped>
.image-card {
  position: relative;
  background: var(--card-bg);
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  display: flex;
  flex-direction: column;
}

.image-card:hover {
  transform: translateY(-4px);
  border-color: var(--accent-color);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
}

.image-card.selected {
  border-color: var(--accent-color);
  background: rgba(34, 197, 94, 0.05);
}

.card-selection {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  color: white;
  opacity: 0.5;
  transition: all 0.2s;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.card-selection.active {
  color: var(--accent-color);
  opacity: 1;
}

.card-preview {
  position: relative;
  aspect-ratio: 4/3;
  overflow: hidden;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.5s;
}

.image-card:hover .card-preview img {
  transform: scale(1.05);
}

.status-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.success-indicator {
  position: absolute;
  top: 12px;
  right: 12px;
  background: var(--accent-color);
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
}

.card-meta {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meta-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.meta-top .name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-top .size {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 99px;
  background: var(--bg-color);
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid var(--border-color);
}

.status-pill.done { color: var(--accent-color); border-color: rgba(34, 197, 94, 0.3); }
.status-pill.processing { color: #3B82F6; border-color: rgba(59, 130, 246, 0.3); }
.status-pill.error { color: #EF4444; border-color: rgba(239, 68, 68, 0.3); }

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-pill.processing .pulse-dot {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
  100% { opacity: 1; transform: scale(1); }
}

.mini-download {
  background: var(--hover-bg);
  border: none;
  color: var(--text-primary);
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.mini-download:hover {
  background: var(--accent-color);
  color: white;
  transform: scale(1.1);
}

.remove-btn {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 24px;
  height: 24px;
  background: #EF4444;
  color: white;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  z-index: 10;
}

.image-card:hover .remove-btn {
  opacity: 1;
  transform: scale(1);
  top: 8px;
  right: 8px;
}

.remove-btn:hover {
  background: #DC2626;
  transform: scale(1.1) !important;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
