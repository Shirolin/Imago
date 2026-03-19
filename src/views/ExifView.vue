<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useLayoutStore } from '../stores/layoutStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import ImageCard from '../components/common/ImageCard.vue'
import {
  Trash2,
  Info,
  MapPin,
  Camera,
  Calendar,
  RefreshCcw,
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  Smartphone,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Eye
} from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import { clearExifEngine, readExif, type ExifData } from '../lib/engines/exifEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()

const activeImageId = ref<string | null>(null)
const exifDataMap = ref<Record<string, ExifData>>({})
const activeExifData = computed(() =>
  activeImageId.value ? exifDataMap.value[activeImageId.value] : null
)
const activeImage = computed(() => store.images.find((img) => img.id === activeImageId.value))
const isReadingExif = ref(false)
const isAllTagsExpanded = ref(false)

const { isProcessing, processSelected } = useImageProcessor(clearExifEngine)

const displayImages = computed(() => [...store.images].reverse())

const scanAllImages = async () => {
  for (const img of store.images) {
    if (img.exifCount === undefined) {
      try {
        const data = await readExif(img.file)
        if (data) {
          exifDataMap.value[img.id] = data
          store.updateImage(img.id, { exifCount: data.metaCount })
        } else {
          store.updateImage(img.id, { exifCount: 0 })
        }
      } catch {
        store.updateImage(img.id, { exifCount: 0 })
      }
    }
  }
}

watch(
  () => store.images.length,
  () => scanAllImages(),
  { immediate: true }
)

watch(activeImageId, async (id) => {
  if (id && !exifDataMap.value[id]) {
    isReadingExif.value = true
    try {
      const img = store.images.find((i) => i.id === id)
      if (img) {
        const data = await readExif(img.file)
        if (data) {
          exifDataMap.value[id] = data
          store.updateImage(id, { exifCount: data.metaCount })
        }
      }
    } finally {
      isReadingExif.value = false
    }
  }
})

onMounted(() => {
  if (store.images.length > 0 && !activeImageId.value) {
    const lastImg = store.images[store.images.length - 1]
    if (lastImg) activeImageId.value = lastImg.id
  }
})

const handleClearExif = async () => {
  await processSelected({})
  for (const id of store.selectedIds) {
    const img = store.images.find((i) => i.id === id)
    if (img) {
      const data = await readExif(img.file)
      if (data) {
        exifDataMap.value[id] = data
        store.updateImage(id, { exifCount: data.metaCount, status: 'done' })
      }
    }
  }
}

const handleCardClick = (id: string) => {
  activeImageId.value = id
  if (!store.selectedIds.has(id)) {
    store.toggleSelection(id)
  }
}
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll>
    <template #header-left><ImageSelectionStatus /></template>
    <template #header-actions><ImageActionsToolbar show-clear-all /></template>

    <template #content>
      <div class="h-full w-full overflow-y-auto custom-scrollbar p-4 md:p-6">
        <div
          v-if="store.images.length === 0"
          class="flex flex-col items-center justify-center py-32 opacity-20"
        >
          <FileSearch :size="64" stroke-width="1" />
          <p class="mt-4 font-bold uppercase tracking-widest text-sm">暂无图片</p>
        </div>

        <div
          v-else
          class="grid transition-all duration-300"
          :class="[
            layoutStore.cardSizeMode === 'compact'
              ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 md:gap-8'
              : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 md:gap-10'
          ]"
        >
          <ImageCard
            v-for="img in displayImages"
            :key="img.id"
            :image="img"
            :is-selected="store.selectedIds.has(img.id)"
            @toggle="handleCardClick"
            @remove="store.removeImage"
            :class="[
              activeImageId === img.id
                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                : ''
            ]"
          >
            <template #overlay="{ image }">
              <div
                v-if="activeImageId === image.id"
                class="px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-lg bg-primary text-primary-foreground animate-in fade-in zoom-in duration-300"
              >
                <Eye :size="10" /> 正在检查
              </div>
            </template>
            <template #meta="{ image }">
              <div
                v-if="image.exifCount !== undefined"
                class="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border"
                :class="[
                  image.exifCount > 0
                    ? 'bg-destructive/5 text-destructive border-destructive/20'
                    : 'bg-primary/5 text-primary border-primary/20'
                ]"
              >
                <ShieldAlert v-if="image.exifCount > 0" :size="10" />
                <ShieldCheck v-else :size="10" />
                <span>{{ image.exifCount > 0 ? `${image.exifCount} 隐私风险` : '安全' }}</span>
              </div>
              <div v-else class="h-6 flex items-center">
                <div class="w-10 h-1 bg-muted/40 rounded-full animate-pulse"></div>
              </div>
            </template>
          </ImageCard>
        </div>
      </div>
    </template>

    <template #sidebar>
      <div class="flex flex-col h-full relative">
        <div class="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
          <div
            v-if="activeImage"
            class="relative group aspect-video bg-muted/20 rounded-xl overflow-hidden border border-border/40 shadow-sm mb-2"
          >
            <img :src="activeImage.preview" class="w-full h-full object-contain" />
            <div
              class="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent"
            >
              <div
                class="text-[10px] text-white font-bold truncate leading-tight uppercase tracking-tight"
              >
                Checking: {{ activeImage.file.name }}
              </div>
            </div>
          </div>

          <AppSectionHeader title="隐私分析" :icon="Info" />

          <div
            v-if="activeImageId && !isReadingExif"
            class="space-y-6 animate-in fade-in duration-500"
          >
            <div
              v-if="activeExifData?.metaCount"
              class="flex items-center gap-3 p-3 bg-destructive/5 border border-destructive/10 rounded-xl"
            >
              <ShieldAlert :size="18" class="text-destructive shrink-0" />
              <div class="text-[13px] font-bold text-destructive">
                含有 {{ activeExifData.metaCount }} 条隐私数据
              </div>
            </div>

            <div v-if="activeExifData?.metaCount" class="space-y-4 px-1">
              <div v-if="activeExifData?.model" class="flex flex-col gap-1">
                <div class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  拍摄设备
                </div>
                <div class="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Smartphone
                    v-if="
                      activeExifData.model.includes('iPhone') ||
                      activeExifData.model.includes('Android')
                    "
                    :size="14"
                    class="text-muted-foreground"
                  />
                  <Camera v-else :size="14" class="text-muted-foreground" />
                  {{ activeExifData.make }} {{ activeExifData.model }}
                </div>
              </div>
              <div v-if="activeExifData?.dateTime" class="flex flex-col gap-1">
                <div class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  拍摄时间
                </div>
                <div class="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Calendar :size="14" class="text-muted-foreground" />
                  {{ activeExifData.dateTime }}
                </div>
              </div>
              <div v-if="activeExifData?.latitude !== undefined" class="flex flex-col gap-1">
                <div class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  地理位置
                </div>
                <div class="flex items-center gap-2 text-sm font-medium text-foreground font-mono">
                  <MapPin :size="14" class="text-muted-foreground" />
                  {{ activeExifData.latitude.toFixed(4) }}°,
                  {{ activeExifData.longitude?.toFixed(4) }}°
                </div>
              </div>
            </div>

            <div v-if="activeExifData?.all && Object.keys(activeExifData.all).length > 0">
              <button
                @click="isAllTagsExpanded = !isAllTagsExpanded"
                class="flex items-center justify-between w-full text-muted-foreground hover:text-primary transition-colors mb-3"
              >
                <span class="text-[11px] font-bold uppercase tracking-widest">所有标记详情</span>
                <component :is="isAllTagsExpanded ? ChevronUp : ChevronDown" :size="14" />
              </button>
              <div
                v-if="isAllTagsExpanded"
                class="flex flex-wrap gap-1 animate-in slide-in-from-top-1"
              >
                <div
                  v-for="(val, key) in activeExifData.all"
                  :key="key"
                  class="px-2 py-1 bg-muted/40 border border-border/50 rounded text-[9px] text-muted-foreground font-medium"
                >
                  {{ key }}
                </div>
              </div>
            </div>

            <div v-if="!activeExifData?.metaCount" class="py-10 text-center space-y-3">
              <ShieldCheck :size="32" class="text-primary/40 mx-auto" />
              <div class="text-xs font-bold text-muted-foreground">未检测到敏感数据，隐私安全</div>
            </div>
          </div>

          <div
            v-else-if="isReadingExif"
            class="py-20 flex flex-col items-center gap-4 text-muted-foreground"
          >
            <RefreshCcw :size="24" class="animate-spin" />
            <span class="text-xs font-medium uppercase tracking-widest">正在分析中...</span>
          </div>

          <div v-else class="py-20 flex flex-col items-center gap-4 opacity-30">
            <Fingerprint :size="32" />
            <span class="text-xs font-bold uppercase tracking-widest">选择图片查看详情</span>
          </div>
        </div>

        <InspectorFooter>
          <AppButton
            size="lg"
            variant="cta"
            class="w-full h-12 rounded-xl"
            :loading="isProcessing"
            :disabled="!store.selectedCount || isProcessing"
            @click="handleClearExif"
          >
            <template #icon><Trash2 v-if="!isProcessing" :size="18" class="mr-2" /></template>
            <span class="font-bold text-sm">清除元数据 ({{ store.selectedCount }})</span>
          </AppButton>
        </InspectorFooter>
      </div>
    </template>
  </WorkspaceLayout>
</template>
