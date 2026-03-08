<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import {
  Split,
  X,
  Loader2,
  Settings2,
  Scissors,
  Plus,
  Trash2,
  Square,
  CheckSquare
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
  await new Promise((resolve) => setTimeout(resolve, 1500))
  store.images.forEach((img) => {
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
      >
        <template #overlay>
          <!-- 预览网格线 -->
          <div
            v-if="splitMode === 'grid'"
            class="absolute inset-0 grid border border-green-500/50 pointer-events-none"
            :style="{
              gridTemplateRows: `repeat(${rows}, 1fr)`,
              gridTemplateColumns: `repeat(${cols}, 1fr)`
            }"
          >
            <div v-for="n in rows * cols" :key="n" class="border border-green-500/30"></div>
          </div>
        </template>
      </ImageCard>
    </template>

    <template #sidebar>
      <div class="p-6 flex flex-col gap-6 h-full">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2 font-bold text-[0.85rem] text-foreground uppercase">
            <Settings2 :size="18" class="text-primary" /> 分割模式
          </div>
          <div class="flex bg-muted p-1 rounded-xl border border-border">
            <button
              class="flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all"
              :class="
                splitMode === 'grid'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="splitMode = 'grid'"
            >
              网格
            </button>
            <button
              class="flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all"
              :class="
                splitMode === 'tiles'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="splitMode = 'tiles'"
            >
              瓦片
            </button>
          </div>
        </div>

        <div v-if="splitMode === 'grid'" class="flex flex-col gap-4">
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-muted-foreground">行数</label>
              <input
                type="number"
                v-model.number="rows"
                min="1"
                max="10"
                class="p-3 bg-muted border border-border rounded-xl text-foreground font-bold outline-none focus:border-primary transition-colors w-full"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-muted-foreground">列数</label>
              <input
                type="number"
                v-model.number="cols"
                min="1"
                max="10"
                class="p-3 bg-muted border border-border rounded-xl text-foreground font-bold outline-none focus:border-primary transition-colors w-full"
              />
            </div>
          </div>
          <p class="text-[0.7rem] text-primary font-bold text-center mt-3">
            将生成 {{ rows * cols }} 张图片
          </p>
        </div>

        <div v-else class="flex flex-col gap-4">
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-muted-foreground">瓦片宽度 (px)</label>
              <input
                type="number"
                v-model.number="tileWidth"
                min="1"
                class="p-3 bg-muted border border-border rounded-xl text-foreground font-bold outline-none focus:border-primary transition-colors w-full"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-muted-foreground">瓦片高度 (px)</label>
              <input
                type="number"
                v-model.number="tileHeight"
                min="1"
                class="p-3 bg-muted border border-border rounded-xl text-foreground font-bold outline-none focus:border-primary transition-colors w-full"
              />
            </div>
          </div>
        </div>

        <div class="mt-auto flex flex-col gap-3">
          <AppButton size="lg" variant="cta" :loading="isProcessing" @click="handleSplit">
            <template #icon><Scissors v-if="!isProcessing" :size="20" class="mr-2" /></template>
            执行分割
          </AppButton>
          <p class="text-center text-xs text-muted-foreground">分割后将自动打包为 ZIP</p>
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>
