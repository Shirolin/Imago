<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import { Settings2, Layout } from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSlider from '../components/common/AppSlider.vue'

const store = useImageStore()

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
      />
    </template>

    <template #sidebar>
      <div class="p-6 flex flex-col gap-6 h-full">
        <div class="flex flex-col gap-4">
          <AppSectionHeader title="布局预览" :icon="Layout" />
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
          <AppSectionHeader title="网格参数" :icon="Settings2" />

          <div class="flex flex-col gap-4">
            <AppSlider v-model="cols" label="列数" :min="1" :max="6" />
            <AppSlider v-model="gap" label="间距" unit="px" />
            <AppSlider v-model="padding" label="外边距" unit="px" />
            <AppSlider v-model="borderRadius" label="图片圆角" :max="50" unit="px" />
          </div>
        </div>

        <div class="mt-auto flex flex-col gap-3">
          <AppButton size="lg" variant="cta" :loading="isProcessing" @click="handleGenerateGrid">
            <template #icon><Layout v-if="!isProcessing" :size="20" class="mr-2" /></template>
            {{ isProcessing ? '正在生成...' : '生成拼图' }}
          </AppButton>
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>
