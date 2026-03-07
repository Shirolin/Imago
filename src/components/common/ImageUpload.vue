<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Upload, Clipboard, Image as ImageIcon, FileImage, MousePointer2 } from 'lucide-vue-next'

const emit = defineEmits(['upload'])
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const handleFiles = (files: FileList | File[]) => {
  const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))
  if (imageFiles.length > 0) {
    emit('upload', imageFiles)
  }
}

const onDrop = (e: DragEvent) => {
  isDragging.value = false
  if (e.dataTransfer?.files) {
    handleFiles(e.dataTransfer.files)
  }
}

const onFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    handleFiles(target.files)
  }
}

const onPaste = (e: ClipboardEvent) => {
  if (e.clipboardData?.files) {
    handleFiles(e.clipboardData.files)
  }
}

const triggerSelect = () => {
  fileInput.value?.click()
}

onMounted(() => {
  window.addEventListener('paste', onPaste)
})

onUnmounted(() => {
  window.removeEventListener('paste', onPaste)
})
</script>

<template>
  <div 
    class="upload-container"
    :class="{ 'is-dragging': isDragging }"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
    @click="triggerSelect"
  >
    <div class="drag-overlay" v-if="isDragging">
      <div class="overlay-content">
        <MousePointer2 :size="48" class="bounce-icon" />
        <span>松开鼠标立即上传</span>
      </div>
    </div>

    <input 
      type="file" 
      ref="fileInput" 
      multiple 
      accept="image/*" 
      class="hidden-input"
      @change="onFileSelect"
    >
    
    <div class="upload-content">
      <div class="icon-stack">
        <div class="icon-block main">
          <Upload :size="32" />
        </div>
        <div class="icon-block sub left">
          <ImageIcon :size="16" />
        </div>
        <div class="icon-block sub right">
          <FileImage :size="16" />
        </div>
      </div>

      <div class="text-group">
        <h2>点击、拖拽或粘贴图片到这里</h2>
        <p>支持 JPG, PNG, WebP, AVIF 等格式 · 100% 本地处理</p>
      </div>
      
      <div class="action-row">
        <div class="shortcut-badge">
          <kbd>Ctrl</kbd> + <kbd>V</kbd> 粘贴
        </div>
        <div class="divider"></div>
        <div class="format-list">
          <span class="dot"></span>
          浏览器原生支持的所有图片格式
        </div>
      </div>

      <button class="select-button">
        选择图片文件
      </button>
    </div>

    <!-- Background Decoration -->
    <div class="bg-pattern"></div>
  </div>
</template>

<style scoped>
.upload-container {
  position: relative;
  width: 100%;
  min-height: 480px;
  background: var(--card-bg);
  border: 2px dashed var(--border-color);
  border-radius: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: 
    background 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  padding: 2rem;
}

.upload-container:hover {
  border-color: var(--accent-color);
  background: var(--hover-bg);
  transform: translateY(-4px);
  box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.2);
}

.upload-container.is-dragging {
  border-color: var(--accent-color);
  background: rgba(34, 197, 94, 0.05);
  transform: scale(0.99);
}

/* Drag Overlay */
.drag-overlay {
  position: absolute;
  inset: 0;
  background: rgba(34, 197, 94, 0.1);
  backdrop-filter: blur(8px);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid var(--accent-color);
  border-radius: 30px;
}

.overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  color: var(--accent-color);
  font-family: var(--font-heading);
  font-weight: 800;
  font-size: 1.5rem;
}

.bounce-icon {
  animation: bounce 0.6s infinite alternate cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-20px); }
}

/* Hidden Input */
.hidden-input {
  display: none;
}

/* Upload Content */
.upload-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* Icon Stack Styling */
.icon-stack {
  position: relative;
  margin-bottom: 2.5rem;
  width: 100px;
  height: 100px;
}

.icon-block {
  background: var(--bg-color);
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 6px 6px 0px var(--border-color);
  transition: all 0.3s;
}

[data-theme="light"] .icon-block {
  box-shadow: 4px 4px 0px var(--border-color);
}

[data-theme="light"] kbd {
  background: #FFFFFF;
  box-shadow: 0 2px 0 #CBD5E1;
}

[data-theme="light"] .bg-pattern {
  opacity: 0.15;
}

.icon-block.main {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  color: var(--accent-color);
  position: relative;
  z-index: 2;
}

.icon-block.sub {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  position: absolute;
  color: var(--text-secondary);
  z-index: 1;
}

.icon-block.sub.left {
  bottom: -10px;
  left: -20px;
}

.icon-block.sub.right {
  top: -10px;
  right: -20px;
}

.upload-container:hover .icon-block.main {
  transform: translate(-4px, -4px);
  box-shadow: 10px 10px 0px var(--accent-color);
  border-color: var(--accent-color);
}

/* Text Styling */
.text-group h2 {
  font-family: var(--font-heading);
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
  letter-spacing: -0.02em;
}

.text-group p {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 2.5rem;
}

/* Action Row */
.action-row {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 3rem;
}

.shortcut-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 600;
}

kbd {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 2px 6px;
  font-family: inherit;
  box-shadow: 0 2px 0 var(--border-color);
}

.divider {
  width: 1px;
  height: 16px;
  background: var(--border-color);
}

.format-list {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.format-list .dot {
  width: 6px;
  height: 6px;
  background: var(--accent-color);
  border-radius: 50%;
}

/* Select Button */
.select-button {
  padding: 0.875rem 2.5rem;
  background: var(--accent-color);
  color: #FFFFFF;
  border: none;
  border-radius: 14px;
  font-family: var(--font-heading);
  font-size: 1rem;
  font-weight: 700;
  box-shadow: 0 4px 0px #15803d;
  transition: all 0.2s;
  cursor: pointer;
}

[data-theme="light"] .select-button {
  color: #FFFFFF;
}

.select-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 0px #15803d;
}

/* Background Pattern */
.bg-pattern {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(var(--border-color) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.05;
  pointer-events: none;
}
</style>

