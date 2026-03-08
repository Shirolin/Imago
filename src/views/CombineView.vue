<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import {
  Layers,
  X,
  Settings2,
  ArrowDown,
  ArrowRight,
  Grid3X3,
  Plus,
  Trash2,
  MoveLeft,
  MoveRight,
  Square,
  CheckSquare
} from 'lucide-vue-next'

const store = useImageStore()
const { triggerFileInput, handleFileChange } = useFileHelpers()

const combineDirection = ref<'vertical' | 'horizontal' | 'grid'>('vertical')
const spacing = ref(10)
const backgroundColor = ref('#FFFFFF')
const isProcessing = ref(false)

const handleCombine = async () => {
  isProcessing.value = true
  await new Promise((resolve) => setTimeout(resolve, 2000))
  store.images.forEach((img) => {
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
      <div
        class="flex items-center gap-3.5 cursor-pointer px-5 h-11 rounded-full bg-muted/40 border border-border/50 transition-all duration-300 hover:border-primary/50 hover:bg-background hover:-translate-y-[1px] active:scale-[0.96] group"
        @click="store.toggleAll"
      >
        <div
          class="flex items-center justify-center transition-colors duration-200"
          :class="store.isAllSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'"
        >
          <CheckSquare v-if="store.isAllSelected" :size="18" class="drop-shadow-sm" />
          <Square v-else :size="18" />
        </div>
        <div class="flex flex-col justify-center">
          <span class="font-bold text-[0.8rem] text-foreground leading-none tracking-tight"
            >已选择 {{ store.selectedCount }} / {{ store.images.length }}</span
          >
          <span
            class="text-[0.6rem] text-muted-foreground font-black uppercase tracking-[0.1em] mt-0.5 opacity-60 leading-none"
            >全选/反选</span
          >
        </div>
      </div>
    </template>

    <template #header-actions>
      <input
        type="file"
        ref="fileInput"
        multiple
        accept="image/*"
        @change="handleFileChange"
        class="hidden"
      />
      <AppButton variant="secondary" size="md" @click="triggerFileInput">
        <template #icon><Plus :size="16" class="mr-1.5" /></template>
        添加图片
      </AppButton>
      <AppButton
        variant="danger"
        size="md"
        :disabled="!store.selectedCount"
        @click="store.removeSelected"
      >
        <template #icon><Trash2 :size="16" class="mr-1.5" /></template>
        删除选中
      </AppButton>
      <AppButton variant="secondary" size="md" @click="store.clearImages">
        <template #icon><X :size="16" class="mr-1.5" /></template>
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
          <div class="flex gap-1.5 mt-2">
            <button
              @click.stop="moveImage(index, 'prev')"
              :disabled="index === 0"
              class="flex-1 h-6 rounded border border-border bg-muted flex items-center justify-center cursor-pointer transition-colors text-foreground hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-foreground"
            >
              <MoveLeft :size="14" />
            </button>
            <button
              @click.stop="moveImage(index, 'next')"
              :disabled="index === store.images.length - 1"
              class="flex-1 h-6 rounded border border-border bg-muted flex items-center justify-center cursor-pointer transition-colors text-foreground hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-foreground"
            >
              <MoveRight :size="14" />
            </button>
          </div>
        </template>
      </ImageCard>
    </template>

    <template #sidebar>
      <div class="p-6 flex flex-col gap-6 h-full">
        <div class="flex flex-col gap-4">
          <div
            class="flex items-center justify-between font-bold text-[0.85rem] text-foreground uppercase"
          >
            <div class="flex items-center gap-2">
              <Settings2 :size="18" class="text-primary" /> 布局方向
            </div>
          </div>
          <div class="grid grid-cols-3 gap-1.5 bg-muted p-1 rounded-xl border border-border">
            <button
              class="flex flex-col items-center gap-1 p-2.5 rounded-lg text-[0.7rem] font-bold transition-all"
              :class="
                combineDirection === 'vertical'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="combineDirection = 'vertical'"
            >
              <ArrowDown :size="18" /><span>纵向</span>
            </button>
            <button
              class="flex flex-col items-center gap-1 p-2.5 rounded-lg text-[0.7rem] font-bold transition-all"
              :class="
                combineDirection === 'horizontal'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="combineDirection = 'horizontal'"
            >
              <ArrowRight :size="18" /><span>横向</span>
            </button>
            <button
              class="flex flex-col items-center gap-1 p-2.5 rounded-lg text-[0.7rem] font-bold transition-all"
              :class="
                combineDirection === 'grid'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="combineDirection = 'grid'"
            >
              <Grid3X3 :size="18" /><span>网格</span>
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <div
            class="flex items-center justify-between font-bold text-[0.85rem] text-foreground uppercase"
          >
            <span>间距 (px)</span>
            <span class="bg-green-500/10 text-primary px-2 py-0.5 rounded-md text-xs"
              >{{ spacing }}px</span
            >
          </div>
          <input
            type="range"
            v-model.number="spacing"
            min="0"
            max="100"
            class="w-full h-1 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer shadow-[0_0_0_2px_hsl(var(--card))] border-none focus:outline-none"
          />
        </div>

        <div class="flex flex-col gap-4">
          <div
            class="flex items-center justify-between font-bold text-[0.85rem] text-foreground uppercase"
          >
            <span>背景颜色</span>
          </div>
          <div class="flex gap-2">
            <input
              type="color"
              v-model="backgroundColor"
              class="w-9 h-9 border border-border rounded-lg bg-transparent cursor-pointer p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none appearance-none"
            />
            <input
              type="text"
              v-model="backgroundColor"
              class="flex-1 px-3 bg-muted border border-border rounded-lg text-foreground font-mono text-xs outline-none focus:border-primary transition-colors"
              placeholder="#FFFFFF"
            />
          </div>
        </div>

        <div class="mt-auto flex flex-col gap-3">
          <AppButton size="lg" variant="cta" :loading="isProcessing" @click="handleCombine">
            <template #icon><Layers v-if="!isProcessing" :size="20" class="mr-2" /></template>
            执行合并
          </AppButton>
          <p class="text-center text-xs text-muted-foreground">图片将按队列顺序拼合</p>
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>
