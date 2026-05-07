<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '../stores/imageStore'
import { useLayoutStore } from '../stores/layoutStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
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
  Eye,
  Download
} from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppEmptyState from '../components/common/AppEmptyState.vue'
import AppBadge from '../components/common/AppBadge.vue'
import AppSidebarCard from '../components/common/AppSidebarCard.vue'
import AppInfoItem from '../components/common/AppInfoItem.vue'
import { clearExifEngine, readExif, type ExifData } from '../lib/engines/exifEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useFileHelpers, type ZipResultItem } from '../composables/useFileHelpers'
import type { ProcessResult } from '../lib/engines/types'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadAllAsZip } = useFileHelpers()
const { t } = useI18n()

// 本地结果存储
interface LocalResult {
  blob: Blob
  preview: string
  size: number
  isDirty: boolean
}
const results = ref<Map<string, LocalResult>>(new Map())

const cleanupResults = () => {
  results.value.forEach((res) => {
    URL.revokeObjectURL(res.preview)
  })
  results.value.clear()
}

onUnmounted(() => {
  cleanupResults()
})

// 监听图片列表变化，自动清理已删除图片的本地结果
watch(
  () => store.images,
  (newImages) => {
    const currentIds = new Set(newImages.map((img) => img.id))
    results.value.forEach((res, id) => {
      if (!currentIds.has(id)) {
        URL.revokeObjectURL(res.preview)
        results.value.delete(id)
      }
    })

    // 同时清理 EXIF 数据缓存
    Object.keys(exifDataMap.value).forEach((id) => {
      if (!currentIds.has(id)) delete exifDataMap.value[id]
    })
  },
  { deep: true }
)

const activeImageId = ref<string | null>(null)
const exifDataMap = ref<Record<string, ExifData>>({})
const activeExifData = computed(() =>
  activeImageId.value ? exifDataMap.value[activeImageId.value] : null
)
const activeImage = computed(() => store.images.find((img) => img.id === activeImageId.value))
const isReadingExif = ref(false)
const isAllTagsExpanded = ref(false)
const outputFormat = ref<string>('original')
const outputQuality = ref(0.9)

const { isProcessing, processSelected } = useImageProcessor(clearExifEngine)

const displayImages = computed(() => [...store.images].reverse())

const scanAllImages = async () => {
  const pendingImages = store.images.filter((img) => img.exifCount === undefined)
  if (pendingImages.length === 0) return

  const CHUNK_SIZE = 5
  for (let i = 0; i < pendingImages.length; i += CHUNK_SIZE) {
    const chunk = pendingImages.slice(i, i + CHUNK_SIZE)
    await Promise.all(
      chunk.map(async (img) => {
        try {
          const data = await readExif(img.file)
          if (data) {
            store.updateImage(img.id, {
              exifCount: data.metaCount,
              isExifUnsupported: data.unsupported,
              exifError: data.error
            })
            exifDataMap.value[img.id] = data
          } else {
            store.updateImage(img.id, { exifCount: 0 })
          }
        } catch {
          store.updateImage(img.id, { exifCount: 0 })
        }
      })
    )
  }
}

let scanTimeout: ReturnType<typeof setTimeout>
watch(
  () => store.images.length,
  () => {
    clearTimeout(scanTimeout)
    scanTimeout = setTimeout(() => {
      scanAllImages()
    }, 300)
  },
  { immediate: true }
)

watch(activeImageId, async (id) => {
  if (id && !exifDataMap.value[id]) {
    isReadingExif.value = true
    try {
      const img = store.images.find((i) => i.id === id)
      if (img) {
        // 优先读取处理后的结果
        const res = results.value.get(id)
        const fileToRead = res
          ? new File([res.blob], img.file.name, { type: res.blob.type })
          : img.file

        const data = await readExif(fileToRead)
        if (data) {
          exifDataMap.value[id] = data
          store.updateImage(id, {
            exifCount: data.metaCount,
            isExifUnsupported: data.unsupported,
            exifError: data.error
          })
        }
      }
    } finally {
      isReadingExif.value = false
    }
  }
})

onMounted(() => {
  if (store.images.length > 0 && !activeImageId.value) {
    const last = store.images[store.images.length - 1]
    if (last) activeImageId.value = last.id
  }
})

const handleClearExif = async () => {
  await processSelected(
    {
      format: outputFormat.value,
      quality: outputQuality.value
    },
    async (id, result) => {
      const typedResult = result as ProcessResult
      const blob = typedResult.blob || (result as Blob)
      const oldRes = results.value.get(id)
      if (oldRes) URL.revokeObjectURL(oldRes.preview)

      results.value.set(id, {
        blob,
        preview: URL.createObjectURL(blob),
        size: typedResult.size || blob.size,
        isDirty: false
      })

      // 验证清理结果
      const data = await readExif(new File([blob], 'temp', { type: blob.type }))
      if (data) {
        exifDataMap.value[id] = data
        store.updateImage(id, {
          exifCount: data.metaCount,
          isExifUnsupported: data.unsupported,
          exifError: data.error
        })
      }
    }
  )
}

const handleCardClick = (id: string) => {
  activeImageId.value = id
  store.toggleSelection(id)
}

const handleReset = (id: string) => {
  const res = results.value.get(id)
  if (res) {
    URL.revokeObjectURL(res.preview)
    results.value.delete(id)
  }
  // 重新读取原始 EXIF
  const img = store.images.find((i) => i.id === id)
  if (img) {
    readExif(img.file).then((data) => {
      if (data) {
        exifDataMap.value[id] = data
        store.updateImage(id, {
          exifCount: data.metaCount,
          isExifUnsupported: data.unsupported,
          exifError: data.error,
          status: 'idle',
          progress: 0
        })
      }
    })
  }
}

watch(
  [outputFormat, outputQuality],
  () => {
    results.value.forEach((res) => {
      res.isDirty = true
    })
  },
  { deep: true }
)

const ctaState = computed(() => {
  if (store.selectedCount === 0)
    return { text: t('tools.exif.cta.select'), icon: Trash2, action: 'none', disabled: true }
  if (isProcessing.value)
    return { text: t('tools.exif.cta.processing'), icon: Trash2, action: 'none', disabled: true }

  const selectedImages = store.images.filter((img) => store.selectedIds.has(img.id))
  const allDoneAndClean =
    selectedImages.length > 0 &&
    selectedImages.every((img) => {
      const res = results.value.get(img.id)
      return img.status === 'done' && res && !res.isDirty
    })

  if (allDoneAndClean) {
    return {
      text: t('tools.exif.cta.export', { count: store.selectedCount }),
      icon: Download,
      action: 'download',
      disabled: false
    }
  }

  const anyDirty = selectedImages.some((img) => {
    const res = results.value.get(img.id)
    return img.status === 'done' && res?.isDirty
  })
  return {
    text: anyDirty
      ? t('tools.exif.cta.process', { count: store.selectedCount })
      : t('tools.exif.cta.process', { count: store.selectedCount }),
    icon: Trash2,
    action: 'process',
    disabled: false
  }
})

const handleCtaClick = async () => {
  const state = ctaState.value
  if (state.action === 'none') return

  if (state.action === 'download') {
    const zipResults = store.images
      .filter((img) => store.selectedIds.has(img.id))
      .map((img) => {
        const res = results.value.get(img.id)
        return {
          file: img.file,
          processedBlob: res?.blob,
          status: img.status
        }
      })
      .filter((r) => r.status === 'done' && r.processedBlob) as ZipResultItem[]

    await downloadAllAsZip('exif', zipResults)
    return
  }

  if (state.action === 'process') {
    await handleClearExif()
  }
}
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll>
    <template #header-left><ImageSelectionStatus :show-card-size="false" /></template>
    <template #header-actions
      ><ImageActionsToolbar view-id="exif" show-clear-all @reset-all="cleanupResults"
    /></template>

    <template #content>
      <div class="h-full w-full overflow-y-auto custom-scrollbar p-4 md:p-6">
        <AppEmptyState
          v-if="store.images.length === 0"
          :title="t('tools.exif.empty.title')"
          :description="t('tools.exif.empty.desc')"
          :icon="FileSearch"
        />
        <div
          v-else
          class="grid transition-all duration-300"
          :class="[
            layoutStore.cardSizeMode === 'compact'
              ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 lg:gap-8'
              : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 lg:gap-10'
          ]"
        >
          <ImageCard
            v-for="img in displayImages"
            :key="img.id"
            :image="img"
            :is-selected="store.selectedIds.has(img.id)"
            :processed-preview="results.get(img.id)?.preview"
            :processed-blob="results.get(img.id)?.blob"
            :is-dirty="results.get(img.id)?.isDirty"
            :allow-magnifier="false"
            @toggle="handleCardClick"
            @remove="store.removeImage"
            @reset="handleReset"
            :class="[
              activeImageId === img.id
                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                : ''
            ]"
          >
            <template #overlay="{ image }"
              ><div
                v-if="activeImageId === image.id"
                class="px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-lg bg-primary text-primary-foreground animate-in fade-in zoom-in duration-300"
              >
                <Eye :size="10" />{{ t('tools.exif.checking') }}
              </div></template
            >
            <template #meta="{ image }">
              <AppBadge
                v-if="image.exifCount !== undefined"
                :variant="
                  image.isExifUnsupported
                    ? 'muted'
                    : image.exifCount > 0
                      ? 'destructive'
                      : 'primary'
                "
                :icon="
                  !image.isExifUnsupported && image.exifCount > 0
                    ? ShieldAlert
                    : !image.isExifUnsupported
                      ? ShieldCheck
                      : Info
                "
              >
                {{
                  image.isExifUnsupported
                    ? t('tools.exif.unsupported')
                    : image.exifCount > 0
                      ? t('tools.exif.riskCount', { count: image.exifCount })
                      : t('tools.exif.safe')
                }}
              </AppBadge>
              <div v-else class="h-6 flex items-center">
                <div class="w-10 h-1 bg-muted/40 rounded-full animate-pulse"></div>
              </div>
            </template>
          </ImageCard>
        </div>
      </div>
    </template>

    <template #sidebar>
      <div
        v-if="activeImage"
        class="relative aspect-video bg-muted/20 rounded-xl overflow-hidden border border-border/40 shadow-sm mb-4 shrink-0"
      >
        <img
          :src="results.get(activeImageId!)?.preview || activeImage.preview"
          class="w-full h-full object-contain"
        />
        <div
          class="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-background/80 via-background/20 to-transparent"
        >
          <div class="text-[10px] text-foreground font-bold truncate uppercase tracking-tight">
            Checking: {{ activeImage.file.name }}
          </div>
        </div>
      </div>
      <section class="space-y-4">
        <AppSectionHeader :title="t('tools.exif.privacyList')" :icon="Info" />
        <AppSidebarCard
          v-if="activeImageId && !isReadingExif"
          class="space-y-4 animate-in fade-in duration-500"
        >
          <div
            v-if="activeExifData?.metaCount"
            class="flex items-center gap-3 p-3 bg-destructive/5 border border-destructive/10 rounded-xl"
          >
            <ShieldAlert :size="18" class="text-destructive shrink-0" />
            <div class="text-[13px] font-bold text-destructive">
              {{ t('tools.exif.riskDetail', { count: activeExifData.metaCount }) }}
            </div>
          </div>
          <div v-if="activeExifData?.metaCount" class="space-y-4 px-1">
            <AppInfoItem
              v-if="activeExifData?.model"
              :label="t('tools.exif.items.device')"
              :icon="activeExifData.model.includes('iPhone') ? Smartphone : Camera"
            >
              {{ activeExifData.make }} {{ activeExifData.model }}
            </AppInfoItem>

            <AppInfoItem
              v-if="activeExifData?.dateTime"
              :label="t('tools.exif.items.time')"
              :icon="Calendar"
            >
              {{ activeExifData.dateTime }}
            </AppInfoItem>

            <AppInfoItem
              v-if="activeExifData?.latitude !== undefined"
              :label="t('tools.exif.items.location')"
              :icon="MapPin"
              mono
            >
              {{ activeExifData.latitude.toFixed(4) }}°, {{ activeExifData.longitude?.toFixed(4) }}°
            </AppInfoItem>
          </div>
          <div v-if="activeExifData?.all && Object.keys(activeExifData.all).length > 0">
            <button
              @click="isAllTagsExpanded = !isAllTagsExpanded"
              class="flex items-center justify-between w-full text-muted-foreground hover:text-primary transition-all mb-3 px-1 group"
              :aria-expanded="isAllTagsExpanded"
              :aria-label="isAllTagsExpanded ? t('common.collapse') : t('common.expand')"
              aria-controls="exif-tags-details"
            >
              <span class="text-[0.65rem] font-bold uppercase tracking-widest leading-none">{{
                t('tools.exif.allTags')
              }}</span>
              <component
                :is="isAllTagsExpanded ? ChevronUp : ChevronDown"
                :size="14"
                class="transition-transform group-hover:scale-110"
              />
            </button>
            <div
              v-if="isAllTagsExpanded"
              id="exif-tags-details"
              class="flex flex-wrap gap-1.5 animate-in slide-in-from-top-1"
            >
              <div
                v-for="(val, key) in activeExifData.all"
                :key="key"
                class="px-2 py-1 bg-muted/30 border border-border/40 rounded-lg text-[10px] text-muted-foreground font-medium transition-colors hover:bg-muted/50"
              >
                {{ key }}
              </div>
            </div>
          </div>
          <div v-if="!activeExifData?.metaCount" class="py-10 text-center space-y-3">
            <div
              :class="[activeExifData?.unsupported ? 'bg-muted/30' : 'bg-primary/5']"
              class="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
            >
              <ShieldCheck v-if="!activeExifData?.unsupported" :size="24" class="text-primary" />
              <Info v-else :size="24" class="text-muted-foreground/60" />
            </div>
            <div class="text-xs font-bold text-muted-foreground px-4 leading-relaxed">
              {{
                activeExifData?.unsupported
                  ? t('tools.exif.unsupportedTip')
                  : t('tools.exif.safeTip')
              }}
            </div>
            <p v-if="activeExifData?.unsupported" class="text-[10px] text-muted-foreground/40 px-6">
              {{ t('tools.exif.supportedFormats') }}
            </p>
          </div>
        </AppSidebarCard>
        <div
          v-else-if="isReadingExif"
          class="py-20 flex flex-col items-center gap-4 text-muted-foreground"
        >
          <RefreshCcw :size="24" class="animate-spin" /><span
            class="text-xs font-medium uppercase tracking-widest"
            >{{ t('tools.exif.analyzing') }}</span
          >
        </div>
        <div v-else class="py-20 flex flex-col items-center gap-4 opacity-30">
          <Fingerprint :size="32" /><span class="text-xs font-bold uppercase tracking-widest">{{
            t('tools.exif.selectToView')
          }}</span>
        </div>
      </section>

      <AppExportSettings
        v-model:format="outputFormat"
        v-model:quality="outputQuality"
        class="pt-6 border-t border-border/40"
      />
    </template>

    <template #footer>
      <InspectorFooter>
        <AppButton
          size="lg"
          :variant="ctaState.action === 'download' ? 'success' : 'cta'"
          class="w-full h-12 rounded-xl shadow-lg transition-all duration-500 active:scale-95 group overflow-hidden"
          :loading="isProcessing || isReadingExif"
          :disabled="ctaState.disabled"
          @click="handleCtaClick"
        >
          <template #icon>
            <component :is="ctaState.icon" v-if="!isProcessing" :size="18" class="mr-2" />
          </template>
          <span class="font-bold text-sm tracking-tight">{{ ctaState.text }}</span>
        </AppButton>
      </InspectorFooter>
    </template>
  </WorkspaceLayout>
</template>
