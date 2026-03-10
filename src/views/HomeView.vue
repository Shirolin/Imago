<script setup lang="ts">
import { ref } from 'vue'
import {
  Minimize2,
  Maximize2,
  Scissors,
  Trash2,
  Split,
  Layers,
  Palette,
  Grid3X3,
  ArrowRight
} from 'lucide-vue-next'
import AppButton from '../components/common/AppButton.vue'

const toolsGrid = ref<HTMLElement | null>(null)

const scrollToTools = () => {
  toolsGrid.value?.scrollIntoView({ behavior: 'smooth' })
}

const tools = [
  {
    name: '图片压缩',
    desc: '减小文件大小而不失真',
    path: '/compress',
    icon: Minimize2,
    color: '#22C55E'
  },
  {
    name: '调整尺寸',
    desc: '按比例或固定像素缩放',
    path: '/resize',
    icon: Maximize2,
    color: '#3b82f6'
  },
  { name: '裁剪图片', desc: '自由裁切或固定比例', path: '/crop', icon: Scissors, color: '#f59e0b' },
  {
    name: '清除 EXIF',
    desc: '删除拍摄地点等隐私元数据',
    path: '/exif',
    icon: Trash2,
    color: '#ef4444'
  },
  { name: '图片分割', desc: '将大图分割为多个网格', path: '/split', icon: Split, color: '#8b5cf6' },
  {
    name: '图片合并',
    desc: '水平或垂直拼接多张图',
    path: '/combine',
    icon: Layers,
    color: '#ec4899'
  },
  {
    name: '色彩滤镜',
    desc: '亮度、对比度与艺术滤镜',
    path: '/filters',
    icon: Palette,
    color: '#6366f1'
  },
  { name: '网格生成', desc: '为图片添加参考网格', path: '/grid', icon: Grid3X3, color: '#14b8a6' }
]
</script>

<template>
  <div class="h-full overflow-y-auto custom-scrollbar">
    <div class="px-6 py-8 md:px-16 md:py-16 w-full max-w-7xl mx-auto">
      <section class="mb-24 flex flex-col items-center text-center w-full">
        <div
          class="inline-flex items-center gap-2 px-4 py-1.5 bg-green-500/10 text-green-600 dark:text-green-500 rounded-full font-bold text-[0.7rem] uppercase tracking-[0.2em] border border-green-500/20 mb-8 backdrop-blur-sm"
        >
          <div class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
          Privacy First
        </div>
        <h1
          class="text-4xl md:text-[5rem] font-black leading-[1.05] mb-8 text-foreground tracking-tighter"
        >
          简单、快速、<br class="hidden md:block" />
          <span
            class="bg-gradient-to-br from-green-400 via-blue-500 to-purple-600 bg-clip-text text-transparent drop-shadow-sm"
            >隐私安全</span
          >
        </h1>
        <p
          class="text-lg md:text-xl text-muted-foreground leading-relaxed mb-12 max-w-2xl font-medium opacity-90"
        >
          所有图片处理均在您的浏览器本地完成，文件永远不会上传服务器。<br
            class="hidden md:block"
          />真正的离线式生产力工具。
        </p>
        <div class="flex flex-col md:flex-row gap-4">
          <AppButton
            size="lg"
            variant="primary"
            :icon="ArrowRight"
            @click="scrollToTools"
            class="text-lg px-10 h-14 active:scale-95 transition-all duration-300"
          >
            快速开始
          </AppButton>
        </div>
      </section>

      <div
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8 scroll-mt-24"
        ref="toolsGrid"
      >
        <router-link
          v-for="tool in tools"
          :key="tool.name"
          :to="tool.path"
          class="group bg-card border border-border/60 rounded-2xl p-6 md:p-8 flex flex-col no-underline text-inherit transition-all duration-300 relative overflow-hidden hover:border-primary/40 hover:-translate-y-1.5 shadow-soft hover:shadow-elevated"
        >
          <!-- 背景高光装饰 - 极大程度淡化 -->
          <div
            class="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-[60px] opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none"
            :style="{ backgroundColor: tool.color }"
          ></div>

          <div class="flex justify-between items-start mb-8 relative z-10">
            <div
              class="w-14 h-14 rounded-xl flex items-center justify-center bg-muted/50 border border-border/50 transition-all duration-300 group-hover:scale-105 group-hover:bg-background group-hover:border-primary/20"
              :style="{ color: tool.color }"
            >
              <component :is="tool.icon" :size="24" stroke-width="2.5" />
            </div>
            <div
              class="text-[0.6rem] font-black bg-muted text-muted-foreground/80 px-2.5 py-1 rounded-full uppercase tracking-widest group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300"
            >
              Ready
            </div>
          </div>
          <div class="mb-6 relative z-10">
            <h3
              class="text-xl font-bold mb-2.5 text-foreground tracking-tight group-hover:text-primary transition-colors"
            >
              {{ tool.name }}
            </h3>
            <p
              class="text-[0.85rem] text-muted-foreground font-medium leading-relaxed opacity-85 group-hover:opacity-100 transition-opacity"
            >
              {{ tool.desc }}
            </p>
          </div>
          <div class="mt-auto relative z-10">
            <div
              class="flex items-center text-primary font-bold text-xs tracking-tight opacity-0 group-hover:opacity-100 translate-x-[-8px] group-hover:translate-x-0 transition-all duration-300"
            >
              即刻开始 <ArrowRight :size="14" class="ml-1.5" />
            </div>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>
