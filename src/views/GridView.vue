<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import {
  Grid3X3,
  X,
  Loader2,
  Settings2,
  Plus,
  Layout,
  Trash2,
  Square,
  CheckSquare
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
  await new Promise((resolve) => setTimeout(resolve, 1800))
  store.images.forEach((img) => {
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
      <div
        class="flex items-center gap-3.5 cursor-pointer px-4 py-2.5 rounded-2xl bg-muted border border-border transition-all duration-300 hover:border-primary hover:bg-background hover:-translate-y-[1px] active:scale-[0.96]"
        @click="store.toggleAll"
      >
        <div
          class="transition-transform duration-200"
          :class="store.isAllSelected ? 'text-primary' : 'text-muted-foreground'"
        >
          <CheckSquare v-if="store.isAllSelected" :size="20" class="drop-shadow-sm" />
          <Square v-else :size="20" />
        </div>
        <div class="flex flex-col">
          <span class="font-extrabold text-sm text-foreground leading-tight"
            >已选择 {{ store.selectedCount }} / {{ store.images.length }}</span
          >
          <span
            class="text-[0.65rem] text-muted-foreground font-bold uppercase tracking-widest mt-0.5 opacity-80"
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
      <AppButton variant="secondary" size="sm" @click="triggerFileInput" class="!px-3 !h-9">
        <template #icon><Plus :size="16" class="mr-1.5" /></template>
        添加图片
      </AppButton>
      <AppButton
        variant="secondary"
        size="sm"
        :disabled="!store.selectedCount"
        @click="store.removeSelected"
        class="!px-3 !h-9 text-destructive border-transparent hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <template #icon><Trash2 :size="16" class="mr-1.5" /></template>
        删除选中
      </AppButton>
      <AppButton variant="secondary" size="sm" @click="store.clearImages" class="!px-3 !h-9">
        <template #icon><X :size="16" class="mr-1.5" /></template>
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
      <div class="p-6 flex flex-col gap-6 h-full">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2 font-bold text-[0.85rem] text-foreground uppercase">
            <Layout :size="18" class="text-primary" /> 布局预览
          </div>
          <div
            class="h-[140px] bg-muted/30 rounded-xl border border-border overflow-auto p-2 custom-scrollbar relative"
          >
            <div class="min-h-full" :style="gridStyle">
              <div
                v-for="img in store.images.slice(0, 12)"
                :key="img.id"
                class="bg-card aspect-square overflow-hidden flex items-center justify-center border border-border"
                :style="{ borderRadius: borderRadius / 4 + 'px' }"
              >
                <img :src="img.preview" alt="" class="w-full h-full object-cover" />
              </div>
              <div
                v-if="store.images.length > 12"
                class="bg-primary aspect-square flex items-center justify-center text-primary-foreground text-[0.6rem] font-extrabold"
                :style="{ borderRadius: borderRadius / 4 + 'px' }"
              >
                +{{ store.images.length - 12 }}
              </div>
            </div>
            <div
              v-if="store.images.length === 0"
              class="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs font-bold"
            >
              暂无图片
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-5">
          <div class="flex items-center gap-2 font-bold text-[0.85rem] text-foreground uppercase">
            <Settings2 :size="18" class="text-primary" /> 网格参数
          </div>

          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <div
                class="flex items-center justify-between text-[0.7rem] font-bold text-muted-foreground"
              >
                列数 <span class="text-primary">{{ cols }}</span>
              </div>
              <input
                type="range"
                v-model.number="cols"
                min="1"
                max="6"
                class="w-full h-1 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer shadow-[0_0_0_2px_hsl(var(--card))] border-none focus:outline-none"
              />
            </div>

            <div class="flex flex-col gap-2">
              <div
                class="flex items-center justify-between text-[0.7rem] font-bold text-muted-foreground"
              >
                间距 <span class="text-primary">{{ gap }}px</span>
              </div>
              <input
                type="range"
                v-model.number="gap"
                min="0"
                max="100"
                class="w-full h-1 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer shadow-[0_0_0_2px_hsl(var(--card))] border-none focus:outline-none"
              />
            </div>

            <div class="flex flex-col gap-2">
              <div
                class="flex items-center justify-between text-[0.7rem] font-bold text-muted-foreground"
              >
                外边距 <span class="text-primary">{{ padding }}px</span>
              </div>
              <input
                type="range"
                v-model.number="padding"
                min="0"
                max="100"
                class="w-full h-1 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer shadow-[0_0_0_2px_hsl(var(--card))] border-none focus:outline-none"
              />
            </div>

            <div class="flex flex-col gap-2">
              <div
                class="flex items-center justify-between text-[0.7rem] font-bold text-muted-foreground"
              >
                图片圆角 <span class="text-primary">{{ borderRadius }}px</span>
              </div>
              <input
                type="range"
                v-model.number="borderRadius"
                min="0"
                max="50"
                class="w-full h-1 bg-muted rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer shadow-[0_0_0_2px_hsl(var(--card))] border-none focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div class="mt-auto flex flex-col gap-3">
          <AppButton size="lg" variant="cta" :loading="isProcessing" @click="handleGenerateGrid">
            <template #icon><Layout v-if="!isProcessing" :size="20" class="mr-2" /></template>
            {{ isProcessing ? '正在生成...' : '生成拼图' }}
          </AppButton>
          <p class="text-center text-xs text-muted-foreground">所有操作在浏览器本地完成</p>
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>
