<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppColorPicker from '../components/common/AppColorPicker.vue'
import ImageUpload from '../components/common/ImageUpload.vue'
import AppCheckbox from '../components/common/AppCheckbox.vue'
import { faviconEngine, FAVICON_SPECS } from '../lib/engines/faviconEngine'
import {
  Box,
  Download,
  Monitor,
  Smartphone,
  Globe,
  Info,
  FileCode,
  FileText,
  LayoutGrid,
  Share2,
  ShieldCheck,
  RefreshCw,
  LayoutIcon
} from 'lucide-vue-next'
import AppTip from '../components/common/AppTip.vue'
import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const { downloadImage } = useFileHelpers()
const { t } = useI18n()

// 状态
const isProcessing = ref(false)
const backgroundColor = ref('transparent')
const selectedIds = ref<Set<string>>(new Set(FAVICON_SPECS.map((s) => s.id)))

// 核心配置：自动安全区缩放
const autoPadding = ref(true)

// Maskable 预览形状：full | circle | squircle | rounded
const maskShapes = ['full', 'circle', 'squircle', 'rounded'] as const
const activeMaskShape = ref<(typeof maskShapes)[number]>('full')

const rotateMaskShape = () => {
  const idx = maskShapes.indexOf(activeMaskShape.value)
  activeMaskShape.value = maskShapes[(idx + 1) % maskShapes.length]!
}

// 与全站逻辑同步
const activeImage = computed(() => store.activeImage)

const toggleSpec = (id: string) => {
  const newSet = new Set(selectedIds.value)
  if (newSet.has(id)) {
    if (newSet.size > 1) newSet.delete(id)
  } else {
    newSet.add(id)
  }
  selectedIds.value = newSet
}

// 分组规格
const groupedSpecs = computed(() => {
  const groups: Record<string, typeof FAVICON_SPECS> = {
    web: FAVICON_SPECS.filter((s) => s.platform === 'web'),
    chrome: FAVICON_SPECS.filter((s) => s.platform === 'chrome'),
    ios: FAVICON_SPECS.filter((s) => s.platform === 'ios'),
    android: FAVICON_SPECS.filter((s) => s.platform === 'android'),
    config: FAVICON_SPECS.filter((s) => s.platform === 'config')
  }
  return groups
})

/**
 * 矩阵排序
 */
const sortedMatrixSpecs = computed(() => {
  const excludeIds = ['apple', 'android192']
  return FAVICON_SPECS.filter(
    (s) => s.type === 'image' && !excludeIds.includes(s.id) && selectedIds.value.has(s.id)
  ).sort((a, b) => (a.size || 0) - (b.size || 0))
})

/**
 * 预览尺寸计算 (用于矩阵展示)
 */
const getPreviewSize = (size: number) => {
  if (size <= 16) return 32
  if (size <= 32) return 40
  if (size <= 64) return 48
  if (size <= 128) return 56
  return 64
}

// 处理生成
const handleGenerate = async () => {
  if (!activeImage.value) return
  isProcessing.value = true
  try {
    const result = await faviconEngine.generateSuite(activeImage.value.file, {
      backgroundColor: backgroundColor.value,
      selectedIds: selectedIds.value,
      autoPadding: autoPadding.value
    })
    downloadImage(result.zip, `favicon_pack_${Date.now()}`, '')
  } catch (error) {
    console.error('Favicon generation failed:', error)
  } finally {
    isProcessing.value = false
  }
}
</script>

<template>
  <WorkspaceLayout show-sidebar show-assets-tray no-scroll>
    <template #header-left><ImageSelectionStatus :show-card-size="false" /></template>
    <template #header-actions>
      <ImageActionsToolbar view-id="favicon" :is-processing="isProcessing" show-clear-all />
    </template>

    <template #content>
      <div class="h-full w-full overflow-y-auto custom-scrollbar bg-muted/5 select-none">
        <div
          v-if="activeImage"
          :key="activeImage.id"
          class="min-h-full w-full flex flex-col items-center py-10 px-6 md:px-12"
        >
          <div
            class="w-full max-w-6xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700"
          >
            <!-- 1. 顶部：环境模拟 -->
            <section
              v-if="selectedIds.has('png16') || selectedIds.has('png32') || selectedIds.has('ico')"
              class="space-y-4"
            >
              <div class="flex items-center gap-2.5 text-muted-foreground/40 pl-1">
                <Globe :size="14" />
                <span class="text-[10px] font-black uppercase tracking-[0.3em]">{{
                  t('tools.favicon.mockup')
                }}</span>
              </div>
              <div
                class="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-elevated w-full"
              >
                <div
                  class="bg-muted/30 px-5 py-2.5 flex items-center gap-2 border-b border-border/40 overflow-hidden"
                >
                  <div class="hidden sm:flex gap-1.5 shrink-0 opacity-20">
                    <div class="w-2.5 h-2.5 rounded-full bg-foreground"></div>
                    <div class="w-2.5 h-2.5 rounded-full bg-foreground"></div>
                    <div class="w-2.5 h-2.5 rounded-full bg-foreground"></div>
                  </div>
                  <div
                    class="sm:ml-6 bg-background border border-border/40 px-3.5 py-1.5 rounded-lg flex items-center gap-2.5 min-w-0 flex-1 sm:flex-none sm:min-w-[180px] shadow-sm ring-1 ring-primary/5"
                  >
                    <div
                      class="w-4 h-4 shrink-0 relative"
                      :style="{
                        backgroundColor:
                          backgroundColor === 'transparent' ? 'transparent' : backgroundColor
                      }"
                    >
                      <div
                        v-if="backgroundColor === 'transparent'"
                        class="absolute inset-0 transparency-grid-sm opacity-40"
                      ></div>
                      <img
                        :src="activeImage.preview"
                        class="w-full h-full object-contain relative z-10"
                        alt="favicon"
                      />
                    </div>
                    <span
                      class="text-[9px] font-black opacity-60 tracking-tight uppercase truncate"
                      >{{ t('tools.favicon.newTab') }}</span
                    >
                  </div>
                </div>
                <div
                  class="h-16 bg-background/20 relative flex items-center justify-center overflow-hidden"
                >
                  <div
                    class="absolute inset-0 opacity-[0.02]"
                    style="
                      background-image: radial-gradient(
                        circle at 2px 2px,
                        var(--foreground) 1px,
                        transparent 0
                      );
                      background-size: 24px 24px;
                    "
                  ></div>
                </div>
              </div>
            </section>

            <!-- 2. 中层：核心平台预览 -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <!-- iOS 预览 -->
              <section v-if="selectedIds.has('apple')" class="space-y-4">
                <div class="flex items-center gap-2.5 text-muted-foreground/40 pl-1">
                  <Smartphone :size="14" />
                  <span class="text-[10px] font-black uppercase tracking-[0.3em]"
                    >Apple iOS Native</span
                  >
                </div>
                <div
                  class="bg-card border border-border/60 rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-8 shadow-elevated group hover:border-primary/20 transition-all min-h-[320px]"
                >
                  <div
                    class="aspect-square w-32 relative shadow-2xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-1 shadow-primary/5 bg-background ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center"
                    :style="{
                      borderRadius: '22.5%',
                      overflow: 'hidden',
                      backgroundColor: backgroundColor === 'transparent' ? 'white' : backgroundColor
                    }"
                  >
                    <img
                      :src="activeImage.preview"
                      class="w-full h-full object-cover transition-transform duration-500"
                    />
                    <div
                      class="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-[inherit]"
                    ></div>
                  </div>
                  <div class="text-center">
                    <div
                      class="text-[10px] font-black text-foreground/60 uppercase tracking-widest leading-none mb-1.5"
                    >
                      Apple Touch Icon
                    </div>
                    <div
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/50 text-[8px] font-bold text-muted-foreground/40 font-mono"
                    >
                      180 × 180 PX
                    </div>
                  </div>
                </div>
              </section>

              <!-- Android Adaptive Simulator (Maskable.app 工业标准对齐版) -->
              <section v-if="selectedIds.has('maskable512')" class="space-y-4">
                <div class="flex items-center justify-between pl-1 pr-4">
                  <div class="flex items-center gap-2.5 text-muted-foreground/40">
                    <ShieldCheck :size="14" />
                    <span class="text-[10px] font-black uppercase tracking-[0.3em]"
                      >Adaptive Simulator</span
                    >
                  </div>
                  <div class="flex items-center gap-4">
                    <button
                      @click="rotateMaskShape"
                      class="flex items-center gap-1.5 text-[9px] font-black text-primary uppercase hover:opacity-80 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 rounded-sm outline-none"
                      :aria-label="t('tools.favicon.rotateShape')"
                      :title="`${t('tools.favicon.currentShape')}: ${activeMaskShape}`"
                    >
                      <RefreshCw :size="10" />
                      Shape: {{ activeMaskShape }}
                    </button>
                  </div>
                </div>
                <div
                  class="bg-card border border-border/60 rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-8 shadow-elevated group hover:border-primary/20 transition-all min-h-[320px] relative overflow-hidden"
                >
                  <div class="absolute top-6 right-8 z-30">
                    <button
                      @click="autoPadding = !autoPadding"
                      class="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all active:scale-95 shadow-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none"
                      :class="
                        autoPadding
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'bg-background border-border text-muted-foreground'
                      "
                      :aria-label="
                        autoPadding
                          ? t('tools.favicon.disableSafeZone')
                          : t('tools.favicon.enableSafeZone')
                      "
                    >
                      <LayoutIcon :size="12" />
                      <span class="text-[9px] font-black uppercase tracking-widest">{{
                        t('tools.favicon.safeZone')
                      }}</span>
                    </button>
                  </div>

                  <!-- 物理容器 ( w-40 = 160px = 100% 物理文件 ) -->
                  <div
                    class="relative w-40 h-40 flex items-center justify-center bg-muted/20 rounded-[2.5rem] shadow-inner ring-1 ring-black/5 dark:ring-white/5 overflow-hidden"
                  >
                    <!-- 【底层】：透明参照层 ( X-Ray View / Canvas Boundary ) -->
                    <div
                      class="absolute inset-0 flex items-center justify-center grayscale mix-blend-multiply dark:mix-blend-screen pointer-events-none transition-all duration-500"
                      :class="activeMaskShape === 'full' ? 'opacity-[0.05]' : 'opacity-[0.25]'"
                    >
                      <div
                        v-if="backgroundColor === 'transparent'"
                        class="absolute inset-0 transparency-grid-sm"
                      ></div>
                      <img
                        :src="activeImage.preview"
                        class="absolute object-contain"
                        :style="{
                          width: autoPadding ? '128px' : '160px',
                          height: autoPadding ? '128px' : '160px',
                          maxWidth: 'none'
                        }"
                        alt="Canvas Boundary Reference"
                      />
                    </div>

                    <!-- 【顶层】：裁切实测层 -->
                    <div
                      class="relative flex items-center justify-center transition-[width,height,border-radius,ring,background-color,shadow] duration-500"
                      :class="{
                        'w-full h-full rounded-2xl ring-1 ring-foreground/[0.03]':
                          activeMaskShape === 'full',
                        'w-[80%] h-[80%] overflow-hidden rounded-full shadow-2xl ring-2 ring-primary/40 dark:ring-primary/60':
                          activeMaskShape === 'circle',
                        'w-[80%] h-[80%] overflow-hidden rounded-[38%] shadow-2xl ring-2 ring-primary/40 dark:ring-primary/60':
                          activeMaskShape === 'squircle',
                        'w-[80%] h-[80%] overflow-hidden rounded-[15%] shadow-2xl ring-2 ring-primary/40 dark:ring-primary/60':
                          activeMaskShape === 'rounded'
                      }"
                      :style="{
                        backgroundColor:
                          backgroundColor === 'transparent' ? 'var(--background)' : backgroundColor
                      }"
                    >
                      <!-- 图片逻辑：工业级正向物理映射 -->
                      <div
                        class="absolute inset-0 flex items-center justify-center overflow-hidden"
                      >
                        <div
                          v-if="backgroundColor === 'transparent'"
                          class="absolute inset-0 transparency-grid-sm opacity-10 pointer-events-none"
                        ></div>
                        <img
                          :src="activeImage.preview"
                          class="absolute transition-all duration-500 object-contain"
                          :style="{
                            width:
                              activeMaskShape === 'full'
                                ? autoPadding
                                  ? '128px'
                                  : '160px'
                                : autoPadding
                                  ? '100%'
                                  : '125%',
                            height:
                              activeMaskShape === 'full'
                                ? autoPadding
                                  ? '128px'
                                  : '160px'
                                : autoPadding
                                  ? '100%'
                                  : '125%',
                            maxWidth: 'none'
                          }"
                          :alt="`Cropped Preview (${activeMaskShape})`"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="text-center space-y-2.5">
                    <div class="flex flex-col items-center gap-1">
                      <span
                        class="text-[10px] font-black text-foreground/60 uppercase tracking-widest leading-none"
                      >
                        {{
                          activeMaskShape === 'full'
                            ? 'Full Asset Preview'
                            : `System Mask Simulation (${activeMaskShape})`
                        }}
                      </span>
                      <p class="text-[9px] font-bold text-primary/70 leading-relaxed max-w-[280px]">
                        {{
                          autoPadding
                            ? t('tools.favicon.safeZoneTipOn')
                            : t('tools.favicon.safeZoneTipOff')
                        }}
                      </p>
                    </div>
                    <div
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/50 text-[8px] font-bold text-muted-foreground/40 font-mono uppercase"
                    >
                      Output Size: 512 × 512 PX
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <!-- 3. 底层：资源矩阵 -->
            <section class="space-y-4">
              <div class="flex items-center gap-2.5 text-muted-foreground/40 pl-1">
                <LayoutGrid :size="14" />
                <span class="text-[10px] font-black uppercase tracking-[0.3em]"
                  >Asset Specification Matrix</span
                >
              </div>
              <div
                class="bg-card border border-border/60 rounded-[2.5rem] p-10 shadow-elevated w-full transition-all hover:border-primary/20"
              >
                <div
                  class="flex flex-wrap items-end justify-center lg:justify-start gap-x-12 gap-y-12 px-2"
                  style="content-visibility: auto"
                >
                  <div
                    v-for="spec in sortedMatrixSpecs"
                    :key="spec.id"
                    class="flex flex-col items-center gap-5 group/item animate-in zoom-in duration-300 outline-none"
                    tabindex="0"
                    @keydown.enter.prevent="toggleSpec(spec.id)"
                    @keydown.space.prevent="toggleSpec(spec.id)"
                    :aria-label="t('tools.favicon.toggleSpec', { name: spec.name })"
                    :aria-pressed="selectedIds.has(spec.id)"
                  >
                    <div
                      class="transition-[transform,shadow,background-color] duration-300 group-hover/item:scale-125 group-focus-visible/item:scale-125 group-focus-visible/item:ring-2 group-focus-visible/item:ring-primary group-focus-visible/item:ring-offset-4 flex items-center justify-center relative bg-background shadow-sm border border-border/20 overflow-hidden ring-1 ring-black/5"
                      :style="{
                        width: getPreviewSize(spec.size!) + 'px',
                        height: getPreviewSize(spec.size!) + 'px',
                        backgroundColor:
                          spec.id === 'maskable512' &&
                          autoPadding &&
                          backgroundColor === 'transparent'
                            ? 'var(--background)'
                            : backgroundColor === 'transparent'
                              ? spec.platform === 'ios'
                                ? 'white'
                                : 'transparent'
                              : backgroundColor,
                        willChange: 'transform',
                        backfaceVisibility: 'hidden'
                      }"
                    >
                      <div
                        v-if="backgroundColor === 'transparent' && spec.platform !== 'ios'"
                        class="absolute inset-0 transparency-grid-sm opacity-20"
                      ></div>
                      <img
                        :src="activeImage.preview"
                        class="w-full h-full object-contain relative z-0 transition-transform duration-300"
                        :style="{
                          transform:
                            spec.id === 'maskable512' && autoPadding ? 'scale(0.8)' : 'scale(1.0)'
                        }"
                        :alt="
                          t('tools.favicon.specPreviewAria', {
                            platform: spec.platform.toUpperCase(),
                            size: spec.size
                          }) +
                          (spec.id === 'maskable512' && autoPadding
                            ? t('tools.favicon.safeZoneAria')
                            : '')
                        "
                      />
                      <div
                        v-if="spec.id === 'ico'"
                        class="absolute top-0 right-0 text-[6px] font-black bg-primary text-primary-foreground px-1 py-0.5 rounded-bl-sm"
                      >
                        ICO
                      </div>
                    </div>
                    <div class="flex flex-col items-center gap-0.5">
                      <span
                        class="text-[9px] font-mono font-black text-foreground/20 group-hover/item:text-primary transition-colors tracking-tighter"
                        >{{ spec.size }}×{{ spec.size }}</span
                      >
                      <span
                        class="text-[7px] font-black text-muted-foreground/20 uppercase tracking-widest leading-none"
                        >{{ spec.id === 'maskable512' ? 'Maskable' : spec.platform }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div v-else class="h-full flex flex-col items-center justify-center p-8">
          <ImageUpload @upload="store.addImages" />
        </div>
      </div>
    </template>

    <template #sidebar>
      <div class="space-y-8 py-2">
        <section class="space-y-4">
          <AppSectionHeader :title="t('tools.favicon.appearance')" :icon="Monitor" />
          <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-4">
            <div class="flex flex-col gap-1 px-1">
              <span
                class="text-[10px] font-black text-muted-foreground uppercase tracking-widest"
                >{{ t('tools.favicon.bgFill') }}</span
              >
              <p class="text-[10px] text-muted-foreground/60 leading-relaxed">
                {{ t('tools.favicon.bgFillDesc') }}
              </p>
            </div>
            <AppColorPicker v-model="backgroundColor" show-transparent />
          </div>
        </section>

        <section class="space-y-4 pt-6 border-t border-border/40 pb-4">
          <AppSectionHeader :title="t('tools.favicon.exportControl')" :icon="Info" />
          <div class="space-y-4">
            <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-6">
              <div v-for="(specs, groupName) in groupedSpecs" :key="groupName" class="space-y-3">
                <div class="flex items-center gap-2 px-1 mb-1">
                  <component
                    :is="
                      groupName === 'web'
                        ? Globe
                        : groupName === 'chrome'
                          ? Share2
                          : groupName === 'ios'
                            ? Smartphone
                            : groupName === 'android'
                              ? Box
                              : FileCode
                    "
                    :size="12"
                    class="text-primary/60"
                  />
                  <span
                    class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60"
                    >{{ groupName }}</span
                  >
                </div>
                <div class="space-y-1.5">
                  <div
                    v-for="spec in specs"
                    :key="spec.id"
                    @click="toggleSpec(spec.id)"
                    class="flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer group select-none hover:translate-x-0.5"
                    :class="
                      selectedIds.has(spec.id)
                        ? 'bg-primary/[0.03] border-primary/30 shadow-sm'
                        : 'bg-muted/5 border-border/40 hover:bg-muted/10'
                    "
                  >
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div
                        v-if="spec.type !== 'image'"
                        class="shrink-0 text-muted-foreground/40 group-hover:text-primary/60 transition-colors"
                      >
                        <FileCode v-if="spec.type === 'config'" :size="12" />
                        <FileText v-else :size="12" />
                      </div>
                      <div class="flex flex-col gap-0 min-w-0">
                        <span
                          class="text-[10px] font-bold text-foreground truncate leading-tight"
                          >{{
                            spec.id === 'manifest' || spec.id === 'readme'
                              ? spec.name
                              : t(`tools.favicon.specs.${spec.id}`)
                          }}</span
                        >
                        <span
                          class="text-[8px] font-medium text-muted-foreground/50 leading-tight"
                          >{{
                            spec.id === 'manifest' || spec.id === 'readme'
                              ? t(`tools.favicon.specs.${spec.id}`)
                              : spec.size + 'x' + spec.size
                          }}</span
                        >
                      </div>
                    </div>
                    <AppCheckbox
                      :model-value="selectedIds.has(spec.id)"
                      class="pointer-events-none scale-90 origin-right"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="selectedIds.has('maskable512')"
              class="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3 animate-in slide-in-from-right-4"
            >
              <div class="flex items-center gap-2 text-primary">
                <ShieldCheck :size="14" />
                <span class="text-[10px] font-black uppercase tracking-widest">Maskable Guide</span>
              </div>
              <p class="text-[9px] text-primary/70 leading-relaxed font-medium">
                {{ t('tools.favicon.safeZoneGuide') }}
              </p>
            </div>

            <AppTip class="mt-2">{{ t('tools.favicon.zipTip') }}</AppTip>
          </div>
        </section>
      </div>
    </template>

    <template #footer>
      <InspectorFooter>
        <AppButton
          size="lg"
          variant="cta"
          class="w-full h-12 rounded-xl shadow-lg transition-all duration-500 active:scale-95 group overflow-hidden"
          :loading="isProcessing"
          :disabled="!activeImage || selectedIds.size === 0"
          @click="handleGenerate"
        >
          <template #icon>
            <Download v-if="!isProcessing" :size="18" class="mr-2" />
          </template>
          {{ t('tools.favicon.cta', { count: selectedIds.size }) }}
        </AppButton>
      </InspectorFooter>
    </template>
  </WorkspaceLayout>
</template>
