<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import {
  Trash2,
  X,
  Loader2,
  Info,
  MapPin,
  Camera,
  Calendar,
  HardDrive,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Plus,
  Square,
  CheckSquare
} from 'lucide-vue-next'

const store = useImageStore()
const { fileInput, triggerFileInput, handleFileChange } = useFileHelpers()

const selectedImageId = ref<string | null>(null)
const isProcessing = ref(false)

const selectedImage = computed(() => {
  return store.images.find((img) => img.id === selectedImageId.value) || store.images[0]
})

// Mock EXIF data
const mockExif = {
  make: 'Apple',
  model: 'iPhone 15 Pro',
  date: '2024-03-15 14:22:05',
  location: '31.2304° N, 121.4737° E (Shanghai)',
  settings: 'f/1.78, 1/120s, ISO 100',
  lens: '24mm (Main)',
  software: 'iOS 17.4'
}

const handleClearExif = async () => {
  isProcessing.value = true
  await new Promise((resolve) => setTimeout(resolve, 1200))
  isProcessing.value = false
  alert('EXIF 信息已成功清除 (模拟)')
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
      <div class="col-span-full h-full flex flex-col">
        <div
          class="flex-1 bg-card border border-border rounded-[20px] overflow-hidden flex flex-col"
        >
          <div
            class="flex gap-3 p-3 bg-background border-b border-border overflow-x-auto custom-scrollbar"
          >
            <div
              v-for="img in store.images"
              :key="img.id"
              class="w-[60px] h-[60px] rounded-[10px] overflow-hidden shrink-0 cursor-pointer border-2 transition-all duration-200 relative"
              :class="
                selectedImage?.id === img.id
                  ? 'border-primary scale-105 z-10'
                  : 'border-transparent hover:border-border'
              "
              @click="selectedImageId = img.id"
            >
              <div
                class="absolute top-[3px] left-[3px] z-[5] bg-card rounded-[4px] p-[1px] flex text-muted-foreground border border-border shadow-sm transition-colors"
                @click.stop="store.toggleSelection(img.id)"
              >
                <CheckSquare v-if="store.selectedIds.has(img.id)" :size="14" class="text-primary" />
                <Square v-else :size="14" />
              </div>
              <img :src="img.preview" alt="" class="w-full h-full object-cover" />
            </div>
          </div>

          <div
            class="flex-1 flex items-center justify-center p-6 border-b border-border bg-background"
            style="
              background-image: radial-gradient(var(--border) 1px, transparent 1px);
              background-size: 24px 24px;
            "
          >
            <div
              v-if="selectedImage"
              class="max-w-full max-h-full flex flex-col items-center gap-4"
            >
              <img
                :src="selectedImage.preview"
                alt="Selected Preview"
                class="max-w-full max-h-[400px] rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
              />
              <div
                class="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-full font-bold text-sm shadow-sm"
              >
                <ShieldAlert :size="20" class="text-destructive" />
                <span class="text-foreground">含有 12 项元数据</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-between items-center">
          <div class="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <Zap :size="16" class="text-primary" />
            <span>所有操作仅在浏览器内完成，您的原始图片不会离开本地。</span>
          </div>
          <AppButton
            size="lg"
            variant="cta"
            :loading="isProcessing"
            @click="handleClearExif"
            class="!px-6"
          >
            <template #icon><Trash2 v-if="!isProcessing" :size="20" class="mr-2" /></template>
            清除所有选定图片的元数据
          </AppButton>
        </div>
      </div>
    </template>

    <template #sidebar>
      <div class="p-6 flex flex-col gap-6 h-full">
        <div class="flex flex-col">
          <div class="flex items-center gap-2 font-bold text-[0.9rem] text-foreground mb-4">
            <Info :size="18" class="text-primary" />
            元数据详情
          </div>

          <div v-if="selectedImage" class="flex flex-col gap-3">
            <div
              class="flex gap-3 p-3 bg-background rounded-xl border border-border transition-all hover:border-primary/50"
            >
              <div
                class="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-primary shrink-0"
              >
                <Camera :size="16" />
              </div>
              <div class="flex flex-col">
                <label
                  class="block text-[0.6rem] font-extrabold uppercase text-muted-foreground mb-[0.1rem]"
                  >相机型号</label
                >
                <p class="text-xs font-semibold text-foreground">
                  {{ mockExif.make }} {{ mockExif.model }}
                </p>
              </div>
            </div>

            <div
              class="flex gap-3 p-3 bg-background rounded-xl border border-border transition-all hover:border-primary/50"
            >
              <div
                class="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-primary shrink-0"
              >
                <Calendar :size="16" />
              </div>
              <div class="flex flex-col">
                <label
                  class="block text-[0.6rem] font-extrabold uppercase text-muted-foreground mb-[0.1rem]"
                  >拍摄时间</label
                >
                <p class="text-xs font-semibold text-foreground">{{ mockExif.date }}</p>
              </div>
            </div>

            <div
              class="flex gap-3 p-3 bg-background rounded-xl border border-border transition-all hover:border-primary/50"
            >
              <div
                class="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-primary shrink-0"
              >
                <MapPin :size="16" />
              </div>
              <div class="flex flex-col">
                <label
                  class="block text-[0.6rem] font-extrabold uppercase text-muted-foreground mb-[0.1rem]"
                  >地理位置</label
                >
                <p class="text-xs font-semibold text-foreground">{{ mockExif.location }}</p>
              </div>
            </div>

            <div
              class="flex gap-3 p-3 bg-background rounded-xl border border-border transition-all hover:border-primary/50"
            >
              <div
                class="w-8 h-8 rounded-lg bg-card flex items-center justify-center text-primary shrink-0"
              >
                <Zap :size="16" />
              </div>
              <div class="flex flex-col">
                <label
                  class="block text-[0.6rem] font-extrabold uppercase text-muted-foreground mb-[0.1rem]"
                  >曝光设置</label
                >
                <p class="text-xs font-semibold text-foreground">{{ mockExif.settings }}</p>
              </div>
            </div>
          </div>

          <div
            v-else
            class="py-8 text-center text-sm font-semibold text-muted-foreground bg-background rounded-xl border border-dashed border-border"
          >
            请选择一张图片查看详情
          </div>
        </div>

        <div class="mt-auto bg-green-500/5 p-4 rounded-xl border border-dashed border-primary/30">
          <h3 class="text-[0.85rem] font-bold text-foreground mb-1.5 flex items-center gap-1.5">
            <ShieldCheck :size="16" class="text-primary" /> 关于 EXIF
          </h3>
          <p class="text-[0.75rem] text-muted-foreground leading-relaxed">
            EXIF 是交换图像文件格式。它包含相机设置、GPS
            坐标和拍摄时间。清除这些信息有助于保护您的隐私。
          </p>
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>
