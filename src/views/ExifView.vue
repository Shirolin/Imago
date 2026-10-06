<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
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
  Download,
  AlertCircle
} from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppEmptyState from '../components/common/AppEmptyState.vue'
import AppBadge from '../components/common/AppBadge.vue'
import AppSidebarCard from '../components/common/AppSidebarCard.vue'
import AppInfoItem from '../components/common/AppInfoItem.vue'
import {
  clearExifEngine,
  readExif,
  exifPrivacyStatus,
  type ExifData
} from '../lib/engines/exifEngine'
import { classifyExifTag } from '../lib/engines/exifTagRegistry'
import { useToolRun } from '../composables/useToolRun'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { t } = useI18n()

const knownImageIds = new Set<string>(store.images.map((img) => img.id))

// 结果集的删图清理由 useToolRun 负责；这里只管 EXIF 侧的三件事：
// exifDataMap 同步清理、activeImageId 跟随新导入的图、knownImageIds 维护。
watch(
  () => store.images,
  (newImages) => {
    const currentIds = new Set(newImages.map((img) => img.id))

    Object.keys(exifDataMap.value).forEach((id) => {
      if (!currentIds.has(id)) delete exifDataMap.value[id]
    })

    for (const img of newImages) {
      if (!knownImageIds.has(img.id)) {
        activeImageId.value = img.id
        break
      }
    }

    knownImageIds.forEach((id) => {
      if (!currentIds.has(id)) knownImageIds.delete(id)
    })
    newImages.forEach((img) => knownImageIds.add(img.id))
  },
  { deep: true }
)

const activeImageId = ref<string | null>(null)
const exifDataMap = ref<Record<string, ExifData>>({})
const activeExifData = computed(() =>
  activeImageId.value ? exifDataMap.value[activeImageId.value] : null
)
const activePrivacyStatus = computed(() => exifPrivacyStatus(activeExifData.value))
const activeImage = computed(() => store.images.find((img) => img.id === activeImageId.value))
const isReadingExif = ref(false)
const isAllTagsExpanded = ref(false)
const outputFormat = ref<string>('original')
const outputQuality = ref(0.9)

let exifReadSeq = 0
let activeExifReads = 0
const beginExifRead = () => {
  activeExifReads++
  isReadingExif.value = true
}
const endExifRead = () => {
  activeExifReads = Math.max(0, activeExifReads - 1)
  if (activeExifReads === 0) isReadingExif.value = false
}

const displayImages = computed(() => [...store.images].reverse())

const scanAllImages = async () => {
  const pendingImages = store.images.filter((img) => img.exifCount === undefined)
  if (pendingImages.length === 0) return

  beginExifRead()
  try {
    const CHUNK_SIZE = 5
    for (let i = 0; i < pendingImages.length; i += CHUNK_SIZE) {
      const chunk = pendingImages.slice(i, i + CHUNK_SIZE)
      await Promise.all(
        chunk.map(async (img) => {
          try {
            const data = await readExif(img.file)
            if (data) {
              store.updateImage(img.id, {
                exifCount: data.privacyCount,
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
  } finally {
    endExifRead()
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
    const seq = ++exifReadSeq
    beginExifRead()
    try {
      const img = store.images.find((i) => i.id === id)
      if (img) {
        const res = resultOf(id)
        const fileToRead = res
          ? new File([res.primary], img.file.name, { type: res.primary.type })
          : img.file

        const data = await readExif(fileToRead)
        if (seq !== exifReadSeq) return
        if (data) {
          exifDataMap.value[id] = data
          store.updateImage(id, {
            exifCount: data.privacyCount,
            isExifUnsupported: data.unsupported,
            exifError: data.error
          })
        }
      }
    } finally {
      endExifRead()
    }
  }
})

onMounted(() => {
  if (store.images.length > 0 && !activeImageId.value) {
    const last = store.images[store.images.length - 1]
    if (last) activeImageId.value = last.id
  }
})

/**
 * 处理 → 结果 → 导出交给 useToolRun。
 *
 * onResult 承担「清除后重读 EXIF」——清除元数据后卡片上的 EXIF 面板要显示
 * 「已清空」而非旧数据。此前这段是 processSelected 的 async 回调，而
 * useImageProcessor 并不 await 它，EXIF 回读实际浮空（写入时机不可控）；
 * 现在由 module 在结果写入后调用，且返回值被 act() 收敛。
 *
 * downloadOne: false —— EXIF 工具的卡片不提供单张下载，只走批量导出。
 */
const toolRun = useToolRun({
  id: 'exif',
  scope: 'selected',
  processor: clearExifEngine,
  downloadOne: false,
  options: () => ({
    format: outputFormat.value,
    quality: outputQuality.value
  }),
  onResult: (id, result) => {
    const blob = result.primary
    void readExif(new File([blob], 'temp', { type: blob.type })).then((data) => {
      if (!data) return
      exifDataMap.value[id] = data
      store.updateImage(id, {
        exifCount: data.privacyCount,
        isExifUnsupported: data.unsupported,
        exifError: data.error
      })
    })
  }
})

const { cta, result: resultOf, act: run, reset, exportAll } = toolRun
const isProcessing = toolRun.isRunning

const handleCardClick = (id: string) => {
  activeImageId.value = id
  store.toggleSelection(id)
}

/** 重置单张：module 负责结果与 status，这里补回该图的原始 EXIF 展示数据 */
const handleReset = (id: string) => {
  reset(id)
  const img = store.images.find((i) => i.id === id)
  if (!img) return
  void readExif(img.file).then((data) => {
    if (!data) return
    exifDataMap.value[id] = data
    store.updateImage(id, {
      exifCount: data.privacyCount,
      isExifUnsupported: data.unsupported,
      exifError: data.error,
      status: 'idle',
      progress: 0
    })
  })
}

const cleanupResults = () => {
  const affected = store.images.filter((img) => img.status === 'done').map((img) => img.id)
  reset()
  affected.forEach((id) => handleReset(id))
}

const ctaCopy = computed(() => {
  switch (cta.value.action) {
    case 'select':
      return { text: t('tools.exif.cta.select'), icon: Trash2 }
    case 'export':
      return { text: t('tools.exif.cta.export', { count: store.selectedCount }), icon: Download }
    default:
      return { text: t('tools.exif.cta.process', { count: store.selectedCount }), icon: Trash2 }
  }
})

const handleCtaClick = async () => {
  await run()
}
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll>
    <template #header-left><ImageSelectionStatus :show-card-size="false" /></template>
    <template #header-actions
      ><ImageActionsToolbar
        view-id="exif"
        show-clear-all
        @reset-all="cleanupResults"
        @export-all="exportAll"
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
              ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 lg:gap-8'
              : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 lg:gap-5'
          ]"
        >
          <ImageCard
            v-for="img in displayImages"
            :key="img.id"
            :image="img"
            :is-selected="store.selectedIds.has(img.id)"
            :processed-preview="resultOf(img.id)?.preview"
            :processed-blob="resultOf(img.id)?.primary"
            :is-dirty="resultOf(img.id)?.dirty"
            :allow-magnifier="false"
            :show-compare="false"
            :show-download="false"
            @toggle="handleCardClick"
            @remove="store.removeImage"
            @reset="handleReset"
          >
            <template #overlay="{ image }"
              ><div
                v-if="activeImageId === image.id && isReadingExif"
                class="px-2 py-0.5 rounded-[var(--radius-ctrl)] text-[10px] font-medium flex items-center gap-1 bg-[var(--accent)] text-[var(--on-product)]"
              >
                <Eye :size="10" />{{ t('tools.exif.checking') }}
              </div></template
            >
            <template #meta="{ image }">
              <AppBadge
                v-if="image.exifCount !== undefined"
                :variant="
                  image.exifError
                    ? 'destructive'
                    : image.isExifUnsupported
                      ? 'muted'
                      : image.exifCount > 0
                        ? 'destructive'
                        : 'primary'
                "
                :icon="
                  image.exifError
                    ? AlertCircle
                    : !image.isExifUnsupported && image.exifCount > 0
                      ? ShieldAlert
                      : !image.isExifUnsupported
                        ? ShieldCheck
                        : Info
                "
              >
                {{
                  image.exifError
                    ? t('common.image.compare.errorTitle')
                    : image.isExifUnsupported
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
        class="relative aspect-video bg-muted/20 rounded-xl overflow-hidden border border-[var(--hairline)] mb-4 shrink-0"
      >
        <img
          :src="resultOf(activeImageId!)?.preview || activeImage.preview"
          class="w-full h-full object-contain"
        />
        <div
          class="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-background/80 via-background/20 to-transparent"
        >
          <div class="text-[11px] text-foreground font-medium truncate">
            {{ t('tools.exif.checkingCaption', { name: activeImage.file.name }) }}
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
            v-if="activePrivacyStatus.kind === 'risk'"
            class="flex items-center gap-3 p-3 bg-destructive/5 border border-destructive/10 rounded-xl"
          >
            <ShieldAlert :size="18" class="text-destructive shrink-0" />
            <div class="text-[13px] font-bold text-destructive">
              {{ t('tools.exif.riskDetail', { count: activePrivacyStatus.count }) }}
            </div>
          </div>
          <div v-if="activePrivacyStatus.kind === 'risk'" class="space-y-4 px-1">
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
              <!-- P2-3：经度缺失时显示 '—'，避免悬挂的度数符号 -->
              {{ activeExifData.latitude.toFixed(4) }}°,
              {{
                activeExifData.longitude !== undefined
                  ? `${activeExifData.longitude.toFixed(4)}°`
                  : '—'
              }}
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
              <span class="text-[11px] font-medium leading-none">{{
                t('tools.exif.allTags')
              }}</span>
              <component
                :is="isAllTagsExpanded ? ChevronUp : ChevronDown"
                :size="14"
                class="transition-colors"
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
                :class="[
                  'px-2 py-1 rounded-lg text-[10px] font-medium transition-colors',
                  classifyExifTag(String(key)) === 'technical'
                    ? 'bg-muted/10 border border-transparent text-muted-foreground/50'
                    : 'bg-muted/30 border border-[var(--hairline)] text-muted-foreground hover:bg-muted/50'
                ]"
              >
                {{ key }}
              </div>
            </div>
          </div>
          <div v-if="activeExifData?.error" class="py-10 text-center space-y-3" role="alert">
            <div
              class="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto"
            >
              <AlertCircle :size="24" class="text-destructive" />
            </div>
            <div class="text-xs font-bold text-destructive px-4 leading-relaxed">
              {{ t('common.image.compare.errorTitle') }}
            </div>
            <p class="text-[10px] text-muted-foreground/70 px-6 break-words">
              {{ activeExifData.error }}
            </p>
          </div>
          <div
            v-if="
              (activePrivacyStatus.kind === 'safe' || activePrivacyStatus.kind === 'unsupported') &&
              !activeExifData?.error
            "
            class="py-10 text-center space-y-3"
          >
            <div
              :class="[activePrivacyStatus.kind === 'unsupported' ? 'bg-muted/30' : 'bg-primary/5']"
              class="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
            >
              <ShieldCheck
                v-if="activePrivacyStatus.kind === 'safe'"
                :size="24"
                class="text-primary"
              />
              <Info v-else :size="24" class="text-muted-foreground/60" />
            </div>
            <div class="text-xs font-bold text-muted-foreground px-4 leading-relaxed">
              {{
                activePrivacyStatus.kind === 'unsupported'
                  ? t('tools.exif.unsupportedTip')
                  : t('tools.exif.safeTip')
              }}
            </div>
            <p
              v-if="activePrivacyStatus.kind === 'unsupported'"
              class="text-[10px] text-muted-foreground/40 px-6"
            >
              {{ t('tools.exif.supportedFormats') }}
            </p>
          </div>
        </AppSidebarCard>
        <div
          v-else-if="isReadingExif"
          class="py-20 flex flex-col items-center gap-4 text-muted-foreground"
        >
          <RefreshCcw :size="24" class="animate-spin" /><span class="text-xs font-medium">{{
            t('tools.exif.analyzing')
          }}</span>
        </div>
        <div v-else class="py-20 flex flex-col items-center gap-4 opacity-30">
          <Fingerprint :size="32" /><span class="text-xs font-medium">{{
            t('tools.exif.selectToView')
          }}</span>
        </div>
      </section>

      <AppExportSettings
        v-model:format="outputFormat"
        v-model:quality="outputQuality"
        canvas-only
        class="pt-6 border-t border-[var(--hairline)]"
      />
    </template>

    <template #footer>
      <InspectorFooter>
        <AppButton
          size="lg"
          fill
          :variant="cta.action === 'export' ? 'success' : 'cta'"
          class="w-full rounded-xl transition-colors"
          :loading="isProcessing || isReadingExif"
          :disabled="cta.disabled"
          @click="handleCtaClick"
        >
          <template #icon>
            <component :is="ctaCopy.icon" v-if="!isProcessing" :size="18" class="mr-2" />
          </template>
          {{ ctaCopy.text }}
        </AppButton>
      </InspectorFooter>
    </template>
  </WorkspaceLayout>
</template>
