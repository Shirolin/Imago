<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import { Settings2, Scissors } from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import { splitEngine } from '../lib/engines/splitEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import JSZip from 'jszip'
// 移除未使用的 file-saver 导入，改用原生方式下载

const store = useImageStore()

const splitMode = ref<'grid' | 'tiles'>('grid')
const rows = ref(3)
const cols = ref(3)
const tileWidth = ref(1080)
const tileHeight = ref(1080)

const { isProcessing, processSelected } = useImageProcessor(splitEngine)

const splitModes = [
  { label: '网格', value: 'grid' },
  { label: '瓦片', value: 'tiles' }
]

const handleSplit = async () => {
  const selectedImages = store.images.filter(
    (img) => store.selectedIds.size === 0 || store.selectedIds.has(img.id)
  )

  if (selectedImages.length === 0) return

  const zip = new JSZip()

  for (const img of selectedImages) {
    const result = await splitEngine(img.file, {
      mode: splitMode.value,
      rows: rows.value,
      cols: cols.value,
      tileWidth: tileWidth.value,
      tileHeight: tileHeight.value
    })

    if (result.blobs) {
      const folder = zip.folder(img.file.name.replace(/\.[^/.]+$/, ''))
      result.blobs.forEach((blob, index) => {
        const extension = img.file.type.split('/')[1] || 'png'
        folder?.file(`part_${index + 1}.${extension}`, blob)
      })
      store.updateImage(img.id, { status: 'done' })
    }
  }

  const content = await zip.generateAsync({ type: 'blob' })
  // 使用原生方式下载，因为不确定是否有 file-saver
  const link = document.createElement('a')
  link.href = URL.createObjectURL(content)
  link.download = 'split_images.zip'
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>

<template>
  <WorkspaceLayout show-sidebar>
    <template #header-left>
      <ImageSelectionStatus />
    </template>

    <template #header-actions>
      <ImageActionsToolbar show-clear-all />
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
          <AppSectionHeader title="分割模式" :icon="Settings2" />
          <AppSegmentedControl v-model="splitMode" :options="splitModes" />
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
