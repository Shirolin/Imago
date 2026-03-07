<script setup lang="ts">
import { ref } from 'vue'
import { Minimize2, Maximize2, Scissors, Trash2, Split, Layers, Palette, Grid3X3, ArrowRight } from 'lucide-vue-next'
import AppButton from '../components/common/AppButton.vue'

const toolsGrid = ref<HTMLElement | null>(null)

const scrollToTools = () => {
  toolsGrid.value?.scrollIntoView({ behavior: 'smooth' })
}

const tools = [
  { name: '图片压缩', desc: '减小文件大小而不失真', path: '/compress', icon: Minimize2, color: '#22C55E' },
  { name: '调整尺寸', desc: '按比例或固定像素缩放', path: '/resize', icon: Maximize2, color: '#3b82f6' },
  { name: '裁剪图片', desc: '自由裁切或固定比例', path: '/crop', icon: Scissors, color: '#f59e0b' },
  { name: '清除 EXIF', desc: '删除拍摄地点等隐私元数据', path: '/exif', icon: Trash2, color: '#ef4444' },
  { name: '图片分割', desc: '将大图分割为多个网格', path: '/split', icon: Split, color: '#8b5cf6' },
  { name: '图片合并', desc: '水平或垂直拼接多张图', path: '/combine', icon: Layers, color: '#ec4899' },
  { name: '色彩滤镜', desc: '亮度、对比度与艺术滤镜', path: '/filters', icon: Palette, color: '#6366f1' },
  { name: '网格生成', desc: '为图片添加参考网格', path: '/grid', icon: Grid3X3, color: '#14b8a6' },
]
</script>

<template>
  <div class="view-container">
    <section class="hero">
      <div class="badge">Privacy First</div>
      <h1>简单、快速、<span class="gradient-text">隐私安全</span></h1>
      <p>所有图片处理均在您的浏览器本地完成，文件永远不会上传到我们的服务器。真正的离线式生产力工具。</p>
      <div class="hero-actions">
        <AppButton size="lg" @click="scrollToTools" style="font-size: 1.125rem; padding: 1rem 2rem;">
          快速开始 <ArrowRight :size="18" />
        </AppButton>
      </div>
    </section>

    <div class="tools-grid" ref="toolsGrid">
      <router-link v-for="tool in tools" :key="tool.name" :to="tool.path" class="tool-card cursor-pointer">
        <div class="card-header">
          <div class="tool-icon" :style="{ borderColor: tool.color + '40', color: tool.color }">
            <component :is="tool.icon" :size="24" />
          </div>
          <div class="tool-badge">Pro</div>
        </div>
        <div class="tool-info">
          <h3>{{ tool.name }}</h3>
          <p>{{ tool.desc }}</p>
        </div>
        <div class="card-footer">
          <span class="action-text">打开工具</span>
          <ArrowRight :size="14" class="arrow" />
        </div>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  padding: 4rem 4rem;
  width: 100%;
  margin: 0;
}

.hero {
  text-align: left;
  margin-bottom: 5rem;
  width: 100%;
}

.badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: rgba(34, 197, 94, 0.1);
  color: var(--accent-color);
  border-radius: 99px;
  font-family: var(--font-heading);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border: 1px solid rgba(34, 197, 94, 0.2);
  margin-bottom: 1.5rem;
}

.hero h1 {
  font-size: 4rem;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
  letter-spacing: -0.03em;
}

.gradient-text {
  background: linear-gradient(to right, #22C55E, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero p {
  font-size: 1.25rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 2.5rem;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
  scroll-margin-top: 100px;
}

.tool-card {
  background: var(--primary-color);
  border: 2px solid var(--border-color);
  border-radius: 24px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.tool-card:hover {
  border-color: var(--accent-color);
  transform: translateY(-8px);
  box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.5);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.tool-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
  border: 2px solid var(--border-color);
  transition: all 0.3s;
}

[data-theme="light"] .tool-card {
  box-shadow: 0 4px 0px var(--border-color);
}

[data-theme="light"] .tool-card:hover {
  border-color: var(--accent-color);
  box-shadow: 0 10px 25px -12px rgba(0, 0, 0, 0.15);
}

.tool-badge {
  font-size: 0.7rem;
  font-weight: 700;
  background: var(--border-color);
  color: var(--text-secondary);
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  text-transform: uppercase;
}

.tool-info h3 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  color: var(--text-primary);
}

.tool-info p {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 2rem;
}

.card-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--accent-color);
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 0.9rem;
}

.card-footer .arrow {
  transition: transform 0.3s;
}

.tool-card:hover .arrow {
  transform: translateX(4px);
}

.cursor-pointer {
  cursor: pointer;
}

@media (max-width: 768px) {
  .hero h1 {
    font-size: 2.75rem;
  }
  .view-container {
    padding: 2rem 1.5rem;
  }
}
</style>

