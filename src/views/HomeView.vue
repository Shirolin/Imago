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
  <div class="px-6 py-8 md:px-16 md:py-16 w-full max-w-7xl mx-auto">
    <section class="mb-20 flex flex-col items-start w-full">
      <div
        class="inline-block px-4 py-2 bg-green-500/10 text-green-600 dark:text-green-500 rounded-full font-bold text-xs uppercase tracking-widest border border-green-500/20 mb-6"
      >
        Privacy First
      </div>
      <h1
        class="text-4xl md:text-[4rem] font-extrabold leading-[1.1] mb-6 text-foreground tracking-tight"
      >
        简单、快速、<span
          class="bg-gradient-to-r from-green-500 to-blue-500 bg-clip-text text-transparent"
          >隐私安全</span
        >
      </h1>
      <p class="text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl">
        所有图片处理均在您的浏览器本地完成，文件永远不会上传到我们的服务器。真正的离线式生产力工具。
      </p>
      <div>
        <AppButton
          size="lg"
          @click="scrollToTools"
          class="!text-lg !px-8 !py-6 !rounded-2xl shadow-lg shadow-primary/20"
        >
          快速开始 <ArrowRight :size="20" class="ml-2" />
        </AppButton>
      </div>
    </section>

    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 scroll-mt-24"
      ref="toolsGrid"
    >
      <router-link
        v-for="tool in tools"
        :key="tool.name"
        :to="tool.path"
        class="bg-card border-2 border-border rounded-3xl p-8 flex flex-col no-underline text-inherit transition-all duration-300 relative overflow-hidden group hover:border-primary hover:-translate-y-2 hover:shadow-2xl hover:shadow-black/10 dark:hover:shadow-black/50"
      >
        <div class="flex justify-between items-start mb-8">
          <div
            class="w-14 h-14 rounded-2xl flex items-center justify-center bg-background border-2 transition-all duration-300 group-hover:scale-110"
            :style="{ borderColor: tool.color + '40', color: tool.color }"
          >
            <component :is="tool.icon" :size="24" />
          </div>
          <div
            class="text-[0.7rem] font-bold bg-muted text-muted-foreground px-2.5 py-1 rounded-md uppercase tracking-wider group-hover:bg-primary/10 group-hover:text-primary transition-colors"
          >
            Pro
          </div>
        </div>
        <div class="mb-8">
          <h3 class="text-2xl font-bold mb-3 text-foreground">{{ tool.name }}</h3>
          <p class="text-[0.95rem] text-muted-foreground leading-relaxed">{{ tool.desc }}</p>
        </div>
        <div class="mt-auto flex items-center gap-2 text-primary font-bold text-sm">
          <span>打开工具</span>
          <ArrowRight
            :size="16"
            class="transition-transform duration-300 group-hover:translate-x-1"
          />
        </div>
      </router-link>
    </div>
  </div>
</template>
