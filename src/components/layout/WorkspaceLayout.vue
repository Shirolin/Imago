<script setup lang="ts">
import { useImageStore } from '../../stores/imageStore'
import ImageUpload from '../common/ImageUpload.vue'

const store = useImageStore()

interface Props {
  showSidebar?: boolean
}

withDefaults(defineProps<Props>(), {
  showSidebar: false
})
</script>

<template>
  <div class="view-container">
    <!-- 空状态 -->
    <div v-if="store.images.length === 0" class="empty-state">
      <ImageUpload @upload="store.addImages" />
    </div>
    
    <!-- 工作区 -->
    <div v-else class="workspace" :class="{ 'has-sidebar': showSidebar }">
      <div class="main-area">
        <header class="workspace-header">
          <slot name="header-left"></slot>
          <div class="header-actions">
            <slot name="header-actions"></slot>
          </div>
        </header>

        <div class="image-grid-wrapper custom-scrollbar">
          <div class="image-grid">
            <slot name="content"></slot>
          </div>
        </div>
      </div>

      <!-- 右侧控制面板 (可选) -->
      <aside v-if="showSidebar" class="control-panel">
        <slot name="sidebar"></slot>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
  height: 100%;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.workspace-header {
  height: 72px;
  padding: 0 1.5rem;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.image-grid-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  background: var(--bg-color);
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.control-panel {
  width: 320px;
  background: var(--card-bg);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
}

@media (max-width: 1200px) {
  .control-panel {
    width: 280px;
  }
}
</style>
