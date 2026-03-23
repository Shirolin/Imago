import os

def replace_in_file(path, old, new):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if old in content:
        content = content.replace(old, new)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Success: {path}")
    else:
        print(f"Failed to find target in {path}")

def update_filters():
    old_imports = """  ChevronRight
} from 'lucide-vue-next'
import { filterEngine } from '../lib/engines/filterEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadImage } = useFileHelpers()"""

    new_imports = """  ChevronRight,
  Download
} from 'lucide-vue-next'
import { filterEngine } from '../lib/engines/filterEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadImage, downloadAllAsZip } = useFileHelpers()"""
    replace_in_file('src/views/FiltersView.vue', old_imports, new_imports)

    old_logic = """const handleApplyFilters = async () => {
  await processSelected({
    brightness: brightness.value,
    contrast: contrast.value,
    saturation: saturation.value,
    blur: blur.value,
    sepia: sepia.value,
    grayscale: 0,
    hueRotate: 0,
    invert: 0,
    vignette: 0,
    sharpen: 0,
    noise: 0,
    format: outputFormat.value,
    quality: outputQuality.value
  })
  isDirty.value = false
}

const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) downloadImage(item.processedBlob, item.file.name, '_Filtered')
}

watch(
  [brightness, contrast, saturation, blur, sepia, outputFormat, outputQuality],
  () => {
    isDirty.value = true
    store.markAllAsDirty()
  },
  { deep: true }
)

const buttonText = computed(() => {
  if (isProcessing.value) return '正在应用...'
  if (store.selectedCount > 0) return `对选中的 ${store.selectedCount} 张应用效果`
  return '应用滤镜效果'
})"""
    new_logic = """const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) downloadImage(item.processedBlob, item.file.name, '_Filtered')
}

watch(
  [brightness, contrast, saturation, blur, sepia, outputFormat, outputQuality],
  () => {
    isDirty.value = true
    store.markAllAsDirty()
  },
  { deep: true }
)

const ctaState = computed(() => {
  if (store.selectedCount === 0) return { text: '请选择图片', icon: Sparkles, action: 'none', disabled: true }
  if (isProcessing.value) return { text: '渲染中...', icon: Sparkles, action: 'none', disabled: true }

  const selectedImages = store.images.filter(img => store.selectedIds.has(img.id))
  const allDoneAndClean = selectedImages.length > 0 && selectedImages.every(img => img.status === 'done' && img.processedBlob && !img.isDirty)
  
  if (allDoneAndClean) {
    return { text: `下载成果 (${store.selectedCount})`, icon: Download, action: 'download', disabled: false }
  }

  const anyDirty = selectedImages.some(img => img.status === 'done' && img.isDirty)
  return {
    text: anyDirty ? `更新滤镜 (${store.selectedCount})` : `应用滤镜 (${store.selectedCount})`,
    icon: Sparkles,
    action: 'process',
    disabled: false
  }
})

const handleCtaClick = async () => {
  const state = ctaState.value
  if (state.action === 'none') return

  if (state.action === 'download') {
    await downloadAllAsZip('_Filtered')
    return
  }

  if (state.action === 'process') {
    await processSelected({
      brightness: brightness.value,
      contrast: contrast.value,
      saturation: saturation.value,
      blur: blur.value,
      sepia: sepia.value,
      grayscale: 0,
      hueRotate: 0,
      invert: 0,
      vignette: 0,
      sharpen: 0,
      noise: 0,
      format: outputFormat.value,
      quality: outputQuality.value
    })
    isDirty.value = false
  }
}"""
    replace_in_file('src/views/FiltersView.vue', old_logic, new_logic)

    old_footer = """      <template #footer>
        <InspectorFooter>
          <AppButton
            size="lg"
            variant="cta"
            class="w-full h-12 rounded-xl shadow-xl shadow-primary/10 transition-all active:scale-95"
            :loading="isProcessing"
            :disabled="!store.selectedCount || isProcessing"
            @click="handleApplyFilters"
          >
            <template #icon><Check v-if="!isProcessing" :size="18" class="mr-2" /></template>
            <span class="font-bold text-sm tracking-tight">{{ buttonText }}</span>
          </AppButton>
        </InspectorFooter>
      </template>"""
    new_footer = """      <template #footer>
        <InspectorFooter>
          <AppButton
            size="lg"
            variant="cta"
            class="w-full h-12 rounded-xl shadow-xl transition-all duration-500 active:scale-95 group overflow-hidden"
            :class="[
              ctaState.action === 'download'
                ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-400/20 shadow-emerald-500/20 text-white'
                : 'shadow-primary/10'
            ]"
            :loading="isProcessing"
            :disabled="ctaState.disabled"
            @click="handleCtaClick"
          >
            <template #icon><component :is="ctaState.icon" v-if="!isProcessing" :size="18" class="mr-2" /></template>
            <span class="font-bold text-sm tracking-tight">{{ ctaState.text }}</span>
          </AppButton>
        </InspectorFooter>
      </template>"""
    replace_in_file('src/views/FiltersView.vue', old_footer, new_footer)


def update_compress():
    old_imports = """import { Play, Info, ArrowRight } from 'lucide-vue-next'
import { compressEngine } from '../lib/engines/compressEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { formatSize, downloadImage } = useFileHelpers()"""

    new_imports = """import { Play, Info, ArrowRight, Download } from 'lucide-vue-next'
import { compressEngine } from '../lib/engines/compressEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { formatSize, downloadImage, downloadAllAsZip } = useFileHelpers()"""
    replace_in_file('src/views/CompressView.vue', old_imports, new_imports)

    old_logic = """const handleCompress = async () => {
  await processSelected({
    quality: quality.value,
    format: (outputFormat.value === 'original' ? undefined : outputFormat.value) as any,
    mode: compressionMode.value,
    maxSizeMB: compressionMode.value === 'target' ? targetSizeKB.value / 1024 : undefined,
    colors: outputFormat.value === 'image/png' ? pngColors.value : undefined,
    effort: outputFormat.value === 'image/png' ? pngEffort.value : undefined,
    keepOriginalIfLarger: keepOriginalIfLarger.value,
    preserveExif: preserveExif.value,
    maxWidth: maxWidth.value,
    maxHeight: maxHeight.value
  })
}

const handleCompare = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (!item || !item.processedBlob) return
  comparingImage.value = item
  showCompareModal.value = true
}

const closeCompare = () => {
  showCompareModal.value = false
}
const handleModalLeave = () => {
  comparingImage.value = null
}

const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) downloadImage(item.processedBlob, item.file.name, '_Compressed')
}

watch([quality, outputFormat], () => store.markAllAsDirty(), { deep: true })

const buttonState = computed(() => {
  if (isProcessing.value) {
    const total = store.selectedCount
    const processed = store.images.filter(
      (img) => store.selectedIds.has(img.id) && img.status === 'done'
    ).length
    return {
      text: '正在处理',
      progress: `(${processed}/${total})`,
      loading: true
    }
  }
  if (store.selectedCount > 0) {
    return {
      text: `压缩选中的 ${store.selectedCount} 张`,
      progress: '',
      loading: false
    }
  }
  return {
    text: '开始压缩',
    progress: '',
    loading: false
  }
})"""
    new_logic = """const handleCompare = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (!item || !item.processedBlob) return
  comparingImage.value = item
  showCompareModal.value = true
}

const closeCompare = () => {
  showCompareModal.value = false
}
const handleModalLeave = () => {
  comparingImage.value = null
}

const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) downloadImage(item.processedBlob, item.file.name, '_Compressed')
}

watch([quality, outputFormat, compressionMode, targetSizeKB, pngColors, pngEffort, maxWidth, maxHeight, keepOriginalIfLarger, preserveExif], () => store.markAllAsDirty(), { deep: true })

const ctaState = computed(() => {
  if (store.selectedCount === 0) return { text: '请选择图片', progress: '', icon: Play, action: 'none', disabled: true }
  
  if (isProcessing.value) {
    const total = store.selectedCount
    const processed = store.images.filter(img => store.selectedIds.has(img.id) && img.status === 'done').length
    return { text: '渲染中', progress: `(${processed}/${total})`, icon: Play, action: 'none', disabled: true }
  }

  const selectedImages = store.images.filter(img => store.selectedIds.has(img.id))
  const allDoneAndClean = selectedImages.length > 0 && selectedImages.every(img => img.status === 'done' && img.processedBlob && !img.isDirty)
  
  if (allDoneAndClean) {
    return { text: `下载成果`, progress: `(${store.selectedCount})`, icon: Download, action: 'download', disabled: false }
  }

  const anyDirty = selectedImages.some(img => img.status === 'done' && img.isDirty)
  return {
    text: anyDirty ? '更新压缩' : '开始压缩',
    progress: `(${store.selectedCount})`,
    icon: Play,
    action: 'process',
    disabled: false
  }
})

const handleCtaClick = async () => {
  const state = ctaState.value
  if (state.action === 'none') return

  if (state.action === 'download') {
    await downloadAllAsZip('_Compressed')
    return
  }

  if (state.action === 'process') {
    await processSelected({
      quality: quality.value,
      format: (outputFormat.value === 'original' ? undefined : outputFormat.value) as any,
      mode: compressionMode.value,
      maxSizeMB: compressionMode.value === 'target' ? targetSizeKB.value / 1024 : undefined,
      colors: outputFormat.value === 'image/png' ? pngColors.value : undefined,
      effort: outputFormat.value === 'image/png' ? pngEffort.value : undefined,
      keepOriginalIfLarger: keepOriginalIfLarger.value,
      preserveExif: preserveExif.value,
      maxWidth: maxWidth.value,
      maxHeight: maxHeight.value
    })
  }
}"""
    replace_in_file('src/views/CompressView.vue', old_logic, new_logic)

    old_footer = """      <template #footer>
        <InspectorFooter>
          <AppButton
            size="lg"
            variant="cta"
            class="w-full h-12 rounded-xl shadow-lg shadow-primary/5 transition-all active:scale-95"
            :loading="isProcessing"
            :disabled="!store.selectedCount || isProcessing"
            @click="handleCompress"
          >
            <template #icon><Play v-if="!isProcessing" :size="18" class="mr-2" /></template>
            <div class="flex items-center justify-center gap-1.5 font-bold text-sm tracking-tight">
              <span>{{ buttonState.text }}</span>
              <span v-if="buttonState.progress" class="tabular-nums opacity-70">{{
                buttonState.progress
              }}</span>
            </div>
          </AppButton>
        </InspectorFooter>
      </template>"""
    new_footer = """      <template #footer>
        <InspectorFooter>
          <AppButton
            size="lg"
            variant="cta"
            class="w-full h-12 rounded-xl shadow-lg transition-all duration-500 active:scale-95 group overflow-hidden"
            :class="[
              ctaState.action === 'download'
                ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-400/20 shadow-emerald-500/20 text-white'
                : 'shadow-primary/5'
            ]"
            :loading="isProcessing"
            :disabled="ctaState.disabled"
            @click="handleCtaClick"
          >
            <template #icon><component :is="ctaState.icon" v-if="!isProcessing" :size="18" class="mr-2" /></template>
            <div class="flex items-center justify-center gap-1.5 font-bold text-sm tracking-tight">
              <span>{{ ctaState.text }}</span>
              <span v-if="ctaState.progress" class="tabular-nums opacity-70">{{ ctaState.progress }}</span>
            </div>
          </AppButton>
        </InspectorFooter>
      </template>"""
    replace_in_file('src/views/CompressView.vue', old_footer, new_footer)


def update_resize():
    old_imports = """import { Settings2, Maximize2, Percent, RotateCcw, ArrowRight, RefreshCw } from 'lucide-vue-next'
import { resizeEngine } from '../lib/engines/resizeEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadImage } = useFileHelpers()"""

    new_imports = """import { Settings2, Maximize2, Percent, RotateCcw, ArrowRight, RefreshCw, Download } from 'lucide-vue-next'
import { resizeEngine } from '../lib/engines/resizeEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadImage, downloadAllAsZip } = useFileHelpers()"""
    replace_in_file('src/views/ResizeView.vue', old_imports, new_imports)

    old_logic = """const handleProcess = async () => {
  if (store.selectedCount === 0) return
  await Array.from(store.selectedIds).reduce(async (p, id) => {
    await p
    await processSingle(id, {
      mode: resizeMode.value === 'dimensions' ? 'pixels' : 'percentage',
      width: width.value,
      height: height.value,
      percentage: percentage.value,
      maintainAspectRatio: maintainAspectRatio.value,
      format: outputFormat.value === 'original' ? undefined : outputFormat.value,
      quality: outputQuality.value,
      preserveExif: preserveExif.value
    })
  }, Promise.resolve())
}

const showCompareModal = ref(false)
const comparingImage = ref<ImageItem | null>(null)
const processedPreviewUrl = ref<string | null>(null)

const handleCompare = async (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (!item) return
  comparingImage.value = item
  if (item.processedBlob) {
    processedPreviewUrl.value = URL.createObjectURL(item.processedBlob)
    showCompareModal.value = true
  }
}

const closeCompare = () => {
  showCompareModal.value = false
}
const handleModalLeave = () => {
  if (processedPreviewUrl.value) {
    URL.revokeObjectURL(processedPreviewUrl.value)
    processedPreviewUrl.value = null
  }
  comparingImage.value = null
}

const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) downloadImage(item.processedBlob, item.file.name, '_Imago_Resized')
}

const buttonText = computed(() => {
  if (isProcessing.value) return '正在处理...'
  if (store.selectedCount > 0) return `调整选中的 ${store.selectedCount} 张`
  return '开始调整尺寸'
})"""
    new_logic = """const showCompareModal = ref(false)
const comparingImage = ref<ImageItem | null>(null)
const processedPreviewUrl = ref<string | null>(null)

const handleCompare = async (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (!item) return
  comparingImage.value = item
  if (item.processedBlob) {
    processedPreviewUrl.value = URL.createObjectURL(item.processedBlob)
    showCompareModal.value = true
  }
}

const closeCompare = () => {
  showCompareModal.value = false
}
const handleModalLeave = () => {
  if (processedPreviewUrl.value) {
    URL.revokeObjectURL(processedPreviewUrl.value)
    processedPreviewUrl.value = null
  }
  comparingImage.value = null
}

const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) downloadImage(item.processedBlob, item.file.name, '_Imago_Resized')
}

const ctaState = computed(() => {
  if (store.selectedCount === 0) return { text: '请选择图片', icon: RefreshCw, action: 'none', disabled: true }
  if (isProcessing.value) return { text: '渲染中...', icon: RefreshCw, action: 'none', disabled: true }

  const selectedImages = store.images.filter(img => store.selectedIds.has(img.id))
  const allDoneAndClean = selectedImages.length > 0 && selectedImages.every(img => img.status === 'done' && img.processedBlob && !img.isDirty)
  
  if (allDoneAndClean) {
    return { text: `下载成果 (${store.selectedCount})`, icon: Download, action: 'download', disabled: false }
  }

  const anyDirty = selectedImages.some(img => img.status === 'done' && img.isDirty)
  return {
    text: anyDirty ? `更新尺寸 (${store.selectedCount})` : `调整尺寸 (${store.selectedCount})`,
    icon: RefreshCw,
    action: 'process',
    disabled: false
  }
})

const handleCtaClick = async () => {
  const state = ctaState.value
  if (state.action === 'none') return

  if (state.action === 'download') {
    await downloadAllAsZip('_Resized')
    return
  }

  if (state.action === 'process') {
    await Array.from(store.selectedIds).reduce(async (p, id) => {
      await p
      await processSingle(id, {
        mode: resizeMode.value === 'dimensions' ? 'pixels' : 'percentage',
        width: width.value,
        height: height.value,
        percentage: percentage.value,
        maintainAspectRatio: maintainAspectRatio.value,
        format: outputFormat.value === 'original' ? undefined : outputFormat.value,
        quality: outputQuality.value,
        preserveExif: preserveExif.value
      })
    }, Promise.resolve())
  }
}"""
    replace_in_file('src/views/ResizeView.vue', old_logic, new_logic)

    old_footer = """      <template #footer>
        <InspectorFooter>
          <AppButton
            size="lg"
            variant="cta"
            class="w-full h-12 rounded-xl shadow-xl shadow-primary/10 transition-all active:scale-95"
            :loading="isProcessing"
            :disabled="!store.selectedCount || isProcessing"
            @click="handleProcess"
          >
            <template #icon><RefreshCw v-if="!isProcessing" :size="18" class="mr-2" /></template>
            <span class="font-bold text-sm tracking-tight">{{ buttonText }}</span>
          </AppButton>
        </InspectorFooter>
      </template>"""
    new_footer = """      <template #footer>
        <InspectorFooter>
          <AppButton
            size="lg"
            variant="cta"
            class="w-full h-12 rounded-xl shadow-xl transition-all duration-500 active:scale-95 group overflow-hidden"
            :class="[
              ctaState.action === 'download'
                ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-400/20 shadow-emerald-500/20 text-white'
                : 'shadow-primary/10'
            ]"
            :loading="isProcessing"
            :disabled="ctaState.disabled"
            @click="handleCtaClick"
          >
            <template #icon><component :is="ctaState.icon" v-if="!isProcessing" :size="18" class="mr-2" /></template>
            <span class="font-bold text-sm tracking-tight">{{ ctaState.text }}</span>
          </AppButton>
        </InspectorFooter>
      </template>"""
    replace_in_file('src/views/ResizeView.vue', old_footer, new_footer)


def update_exif():
    old_imports = """import {
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
const layoutStore = useLayoutStore()"""

    new_imports = """import {
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
import { clearExifEngine, readExif, type ExifData } from '../lib/engines/exifEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useFileHelpers } from '../composables/useFileHelpers'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadAllAsZip } = useFileHelpers()"""
    replace_in_file('src/views/ExifView.vue', old_imports, new_imports)

    old_logic = """const handleClearExif = async () => {
  await processSelected({
    format: outputFormat.value,
    quality: outputQuality.value
  })
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
  if (!store.selectedIds.has(id)) store.toggleSelection(id)
}"""
    new_logic = """const handleCardClick = (id: string) => {
  activeImageId.value = id
  if (!store.selectedIds.has(id)) store.toggleSelection(id)
}

watch([outputFormat, outputQuality], () => store.markAllAsDirty(), { deep: true })

const ctaState = computed(() => {
  if (store.selectedCount === 0) return { text: '请选择图片', icon: Trash2, action: 'none', disabled: true }
  if (isProcessing.value) return { text: '正在清理...', icon: Trash2, action: 'none', disabled: true }

  const selectedImages = store.images.filter(img => store.selectedIds.has(img.id))
  const allDoneAndClean = selectedImages.length > 0 && selectedImages.every(img => img.status === 'done' && img.processedBlob && !img.isDirty)
  
  if (allDoneAndClean) {
    return { text: `下载安全图片 (${store.selectedCount})`, icon: Download, action: 'download', disabled: false }
  }

  const anyDirty = selectedImages.some(img => img.status === 'done' && img.isDirty)
  return {
    text: anyDirty ? `重新清理 (${store.selectedCount})` : `清除隐私数据 (${store.selectedCount})`,
    icon: Trash2,
    action: 'process',
    disabled: false
  }
})

const handleCtaClick = async () => {
  const state = ctaState.value
  if (state.action === 'none') return

  if (state.action === 'download') {
    await downloadAllAsZip('_Safe')
    return
  }

  if (state.action === 'process') {
    await processSelected({
      format: outputFormat.value,
      quality: outputQuality.value
    })
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
}"""
    replace_in_file('src/views/ExifView.vue', old_logic, new_logic)

    old_footer = """    <template #footer>
      <InspectorFooter>
        <AppButton
          size="lg"
          variant="cta"
          class="w-full h-12 rounded-xl shadow-xl shadow-primary/10 transition-all active:scale-95"
          :loading="isProcessing"
          :disabled="!store.selectedCount || isProcessing"
          @click="handleClearExif"
        >
          <template #icon><Trash2 v-if="!isProcessing" :size="18" class="mr-2" /></template>
          <span class="font-bold text-sm">清除隐私元数据 ({{ store.selectedCount }})</span>
        </AppButton>
      </InspectorFooter>
    </template>"""
    new_footer = """    <template #footer>
      <InspectorFooter>
        <AppButton
          size="lg"
          variant="cta"
          class="w-full h-12 rounded-xl shadow-xl transition-all duration-500 active:scale-95 group overflow-hidden"
          :class="[
            ctaState.action === 'download'
              ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-400/20 shadow-emerald-500/20 text-white'
              : 'shadow-primary/10'
          ]"
          :loading="isProcessing"
          :disabled="ctaState.disabled"
          @click="handleCtaClick"
        >
          <template #icon><component :is="ctaState.icon" v-if="!isProcessing" :size="18" class="mr-2" /></template>
          <span class="font-bold text-sm tracking-tight">{{ ctaState.text }}</span>
        </AppButton>
      </InspectorFooter>
    </template>"""
    replace_in_file('src/views/ExifView.vue', old_footer, new_footer)


def update_split():
    old_imports = """import { Scissors, Grid3X3, Layers, Box, AlignCenter, Trash2 } from 'lucide-vue-next'
import { splitEngine } from '../lib/engines/splitEngine'"""

    new_imports = """import { Scissors, Grid3X3, Layers, Box, AlignCenter, Trash2, Download } from 'lucide-vue-next'
import { splitEngine } from '../lib/engines/splitEngine'"""
    replace_in_file('src/views/SplitView.vue', old_imports, new_imports)

    old_saveMeta = """const saveMeta = () => {
  if (selectedImage.value)
    store.updateImage(selectedImage.value.id, {
      splitMeta: {
        linesX: [...linesX.value],
        linesY: [...linesY.value],
        editMode: editMode.value,
        rows: rows.value,
        cols: cols.value
      }
    })
}"""
    new_saveMeta = """const saveMeta = () => {
  if (selectedImage.value) {
    store.updateImage(selectedImage.value.id, {
      splitMeta: {
        linesX: [...linesX.value],
        linesY: [...linesY.value],
        editMode: editMode.value,
        rows: rows.value,
        cols: cols.value
      }
    })
    store.markDirty(selectedImage.value.id)
  }
}"""
    replace_in_file('src/views/SplitView.vue', old_saveMeta, new_saveMeta)

    old_logic = """const clearLines = () => {
  linesX.value = []
  linesY.value = []
  saveMeta()
}

const handleProcess = async () => {
  if (!selectedImage.value) return
  await processSingle(selectedImage.value.id, {
    rows: linesY.value.length + 1,
    cols: linesX.value.length + 1,
    mode: editMode.value,
    centerMode: centerMode.value,
    shave: shave.value,
    format: outputFormat.value === 'original' ? undefined : outputFormat.value,
    quality: outputQuality.value
  })
  if (
    selectedImage.value?.status === 'done' &&
    (selectedImage.value.processedBlob || selectedImage.value.processedBlobs)
  )
    downloadImage(
      selectedImage.value.processedBlobs || selectedImage.value.processedBlob!,
      selectedImage.value.file.name,
      '_Split'
    )
}

useResizeObserver(containerRef, resetView)

const buttonText = computed(() =>
  isProcessing.value
    ? '正在处理...'
    : selectedImage.value?.isDirty
      ? '重新切分并下载'
      : '切分并下载'
)"""
    new_logic = """watch(
  [rows, cols, editMode, centerMode, shave, outputFormat, outputQuality],
  () => {
    if (selectedImage.value) store.markDirty(selectedImage.value.id)
  },
  { deep: true }
)

const clearLines = () => {
  linesX.value = []
  linesY.value = []
  saveMeta()
}

useResizeObserver(containerRef, resetView)

const ctaState = computed(() => {
  const img = selectedImage.value
  if (!img) return { text: '请选择图片', icon: Scissors, action: 'none', disabled: true }
  
  if (isProcessing.value) {
    return { text: '渲染中...', icon: Scissors, action: 'none', disabled: true }
  }
  
  if (img.status === 'done' && (img.processedBlob || img.processedBlobs) && !img.isDirty) {
    return { text: '下载切片', icon: Download, action: 'download', disabled: false }
  }

  return {
    text: img.isDirty ? '更新切分' : '切分图片',
    icon: Scissors,
    action: 'process',
    disabled: false
  }
})

const handleCtaClick = async () => {
  const state = ctaState.value
  if (state.action === 'none') return

  if (state.action === 'download') {
    const img = selectedImage.value
    if (img && (img.processedBlob || img.processedBlobs)) {
      downloadImage(
        img.processedBlobs || img.processedBlob!,
        img.file.name,
        '_Split'
      )
    }
    return
  }

  if (state.action === 'process') {
    const img = selectedImage.value
    if (!img) return
    await processSingle(img.id, {
      rows: linesY.value.length + 1,
      cols: linesX.value.length + 1,
      mode: editMode.value,
      centerMode: centerMode.value,
      shave: shave.value,
      format: outputFormat.value === 'original' ? undefined : outputFormat.value,
      quality: outputQuality.value
    })
  }
}"""
    replace_in_file('src/views/SplitView.vue', old_logic, new_logic)

    old_footer = """    <template #footer>
      <InspectorFooter>
        <AppButton
          size="lg"
          variant="cta"
          class="w-full h-12 rounded-xl shadow-xl shadow-primary/10 active:scale-95 transition-all"
          :loading="isProcessing"
          :disabled="!store.images.length"
          @click="handleProcess"
        >
          <template #icon><Scissors v-if="!isProcessing" :size="18" class="mr-2" /></template>
          <span class="font-bold text-sm tracking-tight">{{ buttonText }}</span>
        </AppButton>
      </InspectorFooter>
    </template>"""
    new_footer = """    <template #footer>
      <InspectorFooter>
        <AppButton
          size="lg"
          variant="cta"
          class="w-full h-12 rounded-xl shadow-xl transition-all duration-500 active:scale-95 group overflow-hidden"
          :class="[
            ctaState.action === 'download'
              ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-400/20 shadow-emerald-500/20 text-white'
              : 'shadow-primary/10'
          ]"
          :loading="isProcessing"
          :disabled="ctaState.disabled"
          @click="handleCtaClick"
        >
          <template #icon><component :is="ctaState.icon" v-if="!isProcessing" :size="18" class="mr-2" /></template>
          <span class="font-bold text-sm tracking-tight">{{ ctaState.text }}</span>
        </AppButton>
      </InspectorFooter>
    </template>"""
    replace_in_file('src/views/SplitView.vue', old_footer, new_footer)

if __name__ == '__main__':
    update_filters()
    update_compress()
    update_resize()
    update_exif()
    update_split()
