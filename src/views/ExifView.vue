<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useImageStore } from '../stores/imageStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import {
  Trash2,
  Info,
  MapPin,
  Camera,
  Calendar,
  RefreshCcw,
  ShieldCheck,
  ShieldAlert,
  Square,
  CheckSquare,
  Fingerprint,
  Smartphone,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppTip from '../components/common/AppTip.vue'
import { clearExifEngine, readExif, type ExifData } from '../lib/engines/exifEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

const store = useImageStore()

const selectedImageId = ref<string | null>(null)
const exifData = ref<ExifData | null>(null)
const isReadingExif = ref(false)
const showSuccessTip = ref(false)
const isAllTagsExpanded = ref(false)

const { isProcessing, processSelected } = useImageProcessor(clearExifEngine)

// 排序逻辑：最新上传的在前
const displayImages = computed(() => {
  return [...store.images].reverse()
})

// 计算当前选中的图片对象
const selectedImage = computed(() => {
  if (!store.images.length) return null
  return (
    store.images.find((img) => img.id === selectedImageId.value) ||
    store.images[store.images.length - 1]
  )
})

// 监听选中的图片，自动解析其 EXIF
watch(
  () => selectedImage.value?.id,
  async (id) => {
    if (!id || !selectedImage.value) {
      exifData.value = null
      return
    }

    isReadingExif.value = true
    showSuccessTip.value = false
    try {
      const data = await readExif(selectedImage.value.file)
      exifData.value = data
    } catch (e) {
      console.error('EXIF Read Error:', e)
      exifData.value = { metaCount: 0 }
    } finally {
      isReadingExif.value = false
    }
  },
  { immediate: true }
)

const handleClearExif = async () => {
  await processSelected({})
  if (selectedImage.value) {
    const data = await readExif(selectedImage.value.file)
    exifData.value = data
    showSuccessTip.value = true
    setTimeout(() => {
      showSuccessTip.value = false
    }, 3000)
  }
}
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll>
    <template #header-left>
      <ImageSelectionStatus />
    </template>

    <template #header-actions>
      <ImageActionsToolbar show-clear-all />
    </template>

    <template #content>
      <div
        class="h-full flex flex-col gap-2.5 p-4 md:p-6 animate-in fade-in duration-500 overflow-hidden w-full"
      >
        <div
          class="flex-1 min-h-0 bg-background border border-border rounded-2xl overflow-hidden flex flex-col shadow-sm relative w-full"
        >
          <!-- Gallery -->
          <div
            class="flex gap-2.5 p-2 bg-muted/30 border-b border-border overflow-x-auto custom-scrollbar shrink-0 w-full"
            role="listbox"
            aria-label="Image gallery"
          >
            <button
              v-for="img in displayImages"
              :key="img.id"
              class="w-12 h-12 rounded-lg overflow-hidden shrink-0 cursor-pointer border-2 transition-all relative outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 group/btn"
              :class="
                selectedImage?.id === img.id
                  ? 'border-primary shadow-sm scale-105 z-10'
                  : 'border-transparent hover:border-border'
              "
              @click="selectedImageId = img.id"
              role="option"
              :aria-selected="selectedImage?.id === img.id"
            >
              <div
                class="absolute top-0 left-0 z-10 p-1.5 flex items-start justify-start transition-transform active:scale-95"
                @click.stop="store.toggleSelection(img.id)"
                role="checkbox"
                :aria-checked="store.selectedIds.has(img.id)"
              >
                <div
                  class="bg-background/90 backdrop-blur rounded p-0.5 border border-border shadow-sm group-hover/btn:border-primary/50 transition-colors"
                >
                  <CheckSquare
                    v-if="store.selectedIds.has(img.id)"
                    :size="10"
                    class="text-primary"
                  />
                  <Square v-else :size="10" class="opacity-40" />
                </div>
              </div>
              <img
                :src="img.preview"
                alt=""
                class="w-full h-full object-cover pointer-events-none group-hover/btn:scale-110 transition-transform duration-500"
              />
              <div
                v-if="img.status === 'done'"
                class="absolute inset-0 bg-primary/5 flex items-center justify-center pointer-events-none"
              >
                <ShieldCheck :size="18" class="text-primary" />
              </div>
            </button>
            <div
              v-if="store.images.length === 0"
              class="flex-1 flex items-center justify-center py-2 text-muted-foreground text-[0.6rem] font-black uppercase tracking-widest"
            >
              Gallery Empty
            </div>
          </div>

          <!-- Preview Area -->
          <div
            class="flex-1 min-h-0 flex flex-col items-center justify-center p-4 bg-muted/10 relative overflow-hidden w-full"
            style="
              background-image: radial-gradient(var(--border) 1px, transparent 1px);
              background-size: 20px 20px;
            "
          >
            <div
              v-if="selectedImage"
              class="w-full h-full flex flex-col items-center justify-center gap-3"
            >
              <div
                class="relative flex-1 min-h-0 w-full flex items-center justify-center group/preview"
              >
                <img
                  :src="selectedImage.preview"
                  alt="Preview"
                  class="max-w-full max-h-full object-contain rounded-lg shadow-elevated border border-border transition-transform duration-500"
                />
                <div
                  v-if="showSuccessTip"
                  class="absolute inset-0 bg-primary/10 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center animate-in zoom-in duration-300"
                >
                  <div
                    class="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg mb-2"
                  >
                    <ShieldCheck :size="28" />
                  </div>
                  <span
                    class="text-primary font-black uppercase tracking-widest text-[0.6rem] bg-background px-3 py-1 rounded-full border border-primary/20"
                    >Privacy Secured</span
                  >
                </div>
              </div>
              <div
                class="shrink-0 flex items-center gap-2 px-3 py-1 bg-background border border-border rounded-full font-black text-[0.6rem] uppercase tracking-widest shadow-sm"
                :class="
                  exifData?.metaCount
                    ? 'text-destructive border-destructive/20'
                    : 'text-primary border-primary/20'
                "
              >
                <ShieldAlert v-if="exifData?.metaCount" :size="12" />
                <ShieldCheck v-else :size="12" />
                <span>{{
                  exifData?.metaCount
                    ? `${exifData.metaCount} Metadata Detected`
                    : 'Privacy Protected'
                }}</span>
              </div>
            </div>
            <div v-else class="flex flex-col items-center justify-center gap-2 opacity-30">
              <Fingerprint :size="32" />
              <p class="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground">
                Select Image
              </p>
            </div>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="flex items-center justify-between px-1 shrink-0 h-10 w-full">
          <div class="flex items-center gap-2 text-muted-foreground">
            <Sparkles :size="12" class="text-primary" />
            <span class="text-[0.55rem] font-black uppercase tracking-wider font-mono"
              >Sandbox Privacy Engine</span
            >
          </div>
          <AppButton
            size="sm"
            variant="danger"
            :loading="isProcessing"
            :disabled="
              !!(!store.selectedCount || isProcessing || (selectedImage && !exifData?.metaCount))
            "
            @click="handleClearExif"
            class="!rounded-lg h-8 px-4"
          >
            <template #icon><Trash2 v-if="!isProcessing" :size="14" class="mr-1.5" /></template>
            <span class="font-black uppercase tracking-widest text-[0.6rem]"
              >清除隐私元数据 ({{ store.selectedCount }})</span
            >
          </AppButton>
        </div>
      </div>
    </template>

    <template #sidebar>
      <div class="p-4 flex flex-col gap-4 h-full overflow-hidden">
        <AppSectionHeader title="PRIVACY ANALYSIS" :icon="Info" class="mb-1 text-foreground" />
        <div class="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-4">
          <div v-if="selectedImage && !isReadingExif" class="flex flex-col gap-3">
            <div
              v-if="exifData?.metaCount"
              class="p-3 bg-destructive/10 rounded-xl border border-destructive/20 flex items-center gap-3"
            >
              <div
                class="w-8 h-8 rounded-lg bg-destructive flex items-center justify-center text-destructive-foreground shrink-0"
              >
                <ShieldAlert :size="16" />
              </div>
              <div class="min-w-0">
                <p
                  class="text-[0.55rem] font-black text-destructive uppercase leading-none mb-1 tracking-widest"
                >
                  Risk Level
                </p>
                <p class="text-[0.7rem] font-bold text-destructive leading-tight italic truncate">
                  Detected {{ exifData.metaCount }} Tags
                </p>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <div
                v-if="exifData?.model"
                class="p-3 bg-muted/50 rounded-xl border border-border flex gap-3 items-center group transition-colors hover:bg-muted"
              >
                <div
                  class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-105"
                >
                  <Smartphone
                    v-if="exifData.model.includes('iPhone') || exifData.model.includes('Android')"
                    :size="16"
                  />
                  <Camera v-else :size="16" />
                </div>
                <div class="min-w-0">
                  <p
                    class="text-[0.55rem] font-black text-muted-foreground uppercase leading-none mb-1 tracking-widest"
                  >
                    Equipment
                  </p>
                  <p class="text-[0.75rem] font-bold text-foreground truncate leading-tight">
                    {{ exifData.make }} {{ exifData.model }}
                  </p>
                </div>
              </div>
              <div
                v-if="exifData?.dateTime"
                class="p-3 bg-muted/50 rounded-xl border border-border flex gap-3 items-center group transition-colors hover:bg-muted"
              >
                <div
                  class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0"
                >
                  <Calendar :size="16" />
                </div>
                <div class="min-w-0">
                  <p
                    class="text-[0.55rem] font-black text-muted-foreground uppercase leading-none mb-1 tracking-widest"
                  >
                    Capture Time
                  </p>
                  <p class="text-[0.75rem] font-bold text-foreground leading-tight truncate">
                    {{ exifData.dateTime }}
                  </p>
                </div>
              </div>
              <div
                v-if="exifData?.latitude !== undefined"
                class="p-3 bg-muted/50 rounded-xl border border-border flex gap-3 items-center group transition-colors hover:bg-muted"
              >
                <div
                  class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0"
                >
                  <MapPin :size="16" />
                </div>
                <div class="min-w-0">
                  <p
                    class="text-[0.55rem] font-black text-muted-foreground uppercase leading-none mb-1 tracking-widest"
                  >
                    Location
                  </p>
                  <p class="text-[0.7rem] font-bold text-foreground leading-tight">
                    {{ exifData.latitude.toFixed(4) }}°, {{ exifData.longitude?.toFixed(4) }}°
                  </p>
                </div>
              </div>
            </div>
            <div v-if="exifData?.all && Object.keys(exifData.all).length > 0" class="mt-2">
              <button
                @click="isAllTagsExpanded = !isAllTagsExpanded"
                class="flex items-center justify-between w-full px-1 mb-2 group text-muted-foreground hover:text-primary transition-colors"
              >
                <span class="text-[0.55rem] font-black uppercase tracking-[0.2em] font-mono"
                  >Hidden Metadata ({{ exifData.metaCount }})</span
                >
                <component
                  :is="isAllTagsExpanded ? ChevronUp : ChevronDown"
                  :size="12"
                  class="opacity-40 group-hover:opacity-100"
                />
              </button>
              <div
                v-if="isAllTagsExpanded"
                class="flex flex-wrap gap-1.5 px-1 animate-in slide-in-from-top-1 duration-300"
              >
                <div
                  v-for="(val, key) in exifData.all"
                  :key="key"
                  class="px-2 py-1 bg-muted border border-border rounded-md text-[0.6rem] font-bold text-muted-foreground transition-all hover:text-foreground hover:border-primary/50 cursor-help"
                  :title="`${key}: ${val}`"
                >
                  {{ key }}
                </div>
              </div>
            </div>
            <div
              v-if="!exifData?.metaCount"
              class="py-10 text-center bg-primary/5 rounded-2xl border border-dashed border-primary/20 animate-in fade-in duration-500"
            >
              <ShieldCheck :size="32" class="text-primary/60 mx-auto mb-3" />
              <p class="text-[0.7rem] font-black text-primary uppercase tracking-[0.3em] mb-1">
                Privacy Secured
              </p>
              <p class="text-[0.6rem] font-bold text-muted-foreground px-8 leading-relaxed">
                No sensitive metadata detected.
              </p>
            </div>
          </div>
          <div
            v-else-if="isReadingExif"
            class="py-24 flex flex-col items-center justify-center gap-3"
          >
            <RefreshCcw :size="28" class="text-primary animate-spin" />
            <p
              class="text-[0.65rem] font-black text-muted-foreground uppercase tracking-[0.4em] animate-pulse"
            >
              Reading...
            </p>
          </div>
          <div
            v-else
            class="py-12 text-center bg-muted/30 rounded-2xl border border-dashed border-border px-8"
          >
            <Fingerprint :size="24" class="mx-auto text-muted-foreground/40 mb-3" />
            <p class="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-[0.2em]">
              Select Image
            </p>
          </div>
        </div>
        <AppTip :icon="ShieldCheck" variant="primary" class="shrink-0">
          <p
            class="text-[0.65rem] text-muted-foreground leading-tight font-medium font-mono text-center"
          >
            Data processing happens entirely in your browser.
          </p>
        </AppTip>
      </div>
    </template>
  </WorkspaceLayout>
</template>
