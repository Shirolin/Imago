<script setup lang="ts">
import { ref, computed } from 'vue'
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

// 状态
const isProcessing = ref(false)
const backgroundColor = ref('transparent')
const selectedIds = ref<Set<string>>(new Set(FAVICON_SPECS.map((s) => s.id)))

// 核心配置：自动安全区缩放
const autoPadding = ref(true)

// Maskable 预览形状：circle | squircle | rounded (已废除 guide 模式)
const maskShapes = ['circle', 'squircle', 'rounded'] as const
const activeMaskShape = ref<(typeof maskShapes)[number]>('circle')

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

const getPreviewSize = (px: number) => {
  if (px <= 32) return px
  if (px === 48) return 40
  if (px <= 192) return 80
  return 110
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
      <ImageActionsToolbar :is-processing="isProcessing" show-clear-all />
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
                <span class="text-[10px] font-black uppercase tracking-[0.3em]"
                  >Environment Mockup</span
                >
              </div>
              <div
                class="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-elevated w-full"
              >
                <div
                  class="bg-muted/30 px-5 py-2.5 flex items-center gap-2 border-b border-border/40"
                >
                  <div class="flex gap-1.5 shrink-0 opacity-20">
                    <div class="w-2.5 h-2.5 rounded-full bg-foreground"></div>
                    <div class="w-2.5 h-2.5 rounded-full bg-foreground"></div>
                    <div class="w-2.5 h-2.5 rounded-full bg-foreground"></div>
                  </div>
                  <div
                    class="ml-6 bg-background border border-border/40 px-3.5 py-1.5 rounded-lg flex items-center gap-2.5 min-w-[180px] shadow-sm ring-1 ring-primary/5"
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
                      />
                    </div>
                    <span class="text-[10px] font-bold opacity-60 tracking-tight uppercase"
                      >New Tab</span
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
                    class="aspect-square w-32 relative shadow-2xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-1 shadow-primary/5 bg-background ring-1 ring-black/5 dark:ring-white/10"
                    :style="{
                      borderRadius: '22.5%',
                      overflow: 'hidden',
                      backgroundColor: backgroundColor === 'transparent' ? 'white' : backgroundColor
                    }"
                  >
                    <img :src="activeImage.preview" class="w-full h-full object-cover" />
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

              <!-- Android Simulator (物理边界修正版) -->
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
                      class="flex items-center gap-1.5 text-[9px] font-black text-primary uppercase hover:opacity-80 transition-opacity"
                    >
                      <RefreshCw :size="10" />
                      Switch Shape
                    </button>
                  </div>
                </div>
                <div
                  class="bg-card border border-border/60 rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-8 shadow-elevated group hover:border-primary/20 transition-all min-h-[320px] relative overflow-hidden"
                >
                  <!-- 自动缩放开关 -->
                  <div class="absolute top-6 right-8 z-30">
                    <button
                      @click="autoPadding = !autoPadding"
                      class="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all active:scale-95 shadow-sm"
                      :class="
                        autoPadding
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'bg-background border-border text-muted-foreground'
                      "
                      title="开启后将自动缩小 Logo 并填充背景以防止被裁切"
                    >
                      <LayoutIcon :size="12" />
                      <span class="text-[9px] font-black uppercase tracking-widest"
                        >Auto Safe-Zone</span
                      >
                    </button>
                  </div>

                  <!-- 物理容器 (模拟手机屏幕局部) -->
                  <div
                    class="relative w-40 h-40 flex items-center justify-center bg-muted/20 rounded-[2.5rem] shadow-inner ring-1 ring-black/5 dark:ring-white/5 overflow-hidden"
                  >
                    <!-- 裁切层 (80% 固定边界) -->
                    <div
                      class="relative w-32 h-32 transition-all duration-500 shadow-2xl ring-1 ring-black/10 dark:ring-white/20 overflow-hidden flex items-center justify-center bg-background"
                      :class="{
                        'rounded-full': activeMaskShape === 'circle',
                        'rounded-[30%]': activeMaskShape === 'squircle',
                        'rounded-2xl': activeMaskShape === 'rounded'
                      }"
                      :style="{
                        backgroundColor:
                          backgroundColor === 'transparent' ? '#ffffff' : backgroundColor
                      }"
                    >
                      <!-- 内部图片：根据保护开关，决定它是 100% (被裁) 还是 80% (契合) -->
                      <div class="absolute inset-0 flex items-center justify-center">
                        <div
                          v-if="backgroundColor === 'transparent'"
                          class="absolute inset-0 transparency-grid-sm opacity-20 pointer-events-none"
                        ></div>
                        <img
                          :src="activeImage.preview"
                          class="transition-all duration-500 object-contain relative z-10"
                          :style="{
                            width: autoPadding ? '100%' : '125%',
                            height: autoPadding ? '100%' : '125%'
                          }"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="text-center space-y-2">
                    <div class="flex flex-col items-center">
                      <span
                        class="text-[10px] font-black text-foreground/60 uppercase tracking-widest leading-none mb-1"
                      >
                        System Preview: {{ activeMaskShape }}
                      </span>
                      <span
                        class="text-[8px] font-bold text-primary/60 uppercase tracking-tighter max-w-[260px]"
                      >
                        {{
                          autoPadding
                            ? '已开启保护：Logo 已缩回安全区，裁切后完美呈现'
                            : '警告：原始满铺模式，Logo 边缘在裁切后将丢失'
                        }}
                      </span>
                    </div>
                    <div
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/50 text-[8px] font-bold text-muted-foreground/40 font-mono uppercase"
                    >
                      512 × 512 PX
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
                >
                  <div
                    v-for="spec in sortedMatrixSpecs"
                    :key="spec.id"
                    class="flex flex-col items-center gap-5 group/item animate-in zoom-in duration-500"
                  >
                    <div
                      class="transition-all group-hover/item:scale-125 flex items-center justify-center relative bg-background shadow-sm border border-border/20 overflow-hidden ring-1 ring-black/5"
                      :style="{
                        width: getPreviewSize(spec.size!) + 'px',
                        height: getPreviewSize(spec.size!) + 'px',
                        backgroundColor:
                          backgroundColor === 'transparent'
                            ? spec.platform === 'ios'
                              ? 'white'
                              : 'transparent'
                            : backgroundColor
                      }"
                    >
                      <div
                        v-if="backgroundColor === 'transparent' && spec.platform !== 'ios'"
                        class="absolute inset-0 transparency-grid-sm opacity-20"
                      ></div>
                      <div
                        v-if="spec.id.includes('maskable') && autoPadding"
                        class="absolute inset-0 border border-dashed border-primary/20 rounded-full scale-[0.8] z-10 pointer-events-none"
                      ></div>
                      <img
                        :src="activeImage.preview"
                        class="w-full h-full object-contain relative z-0 transition-all duration-500"
                        :class="[
                          spec.id.includes('maskable') && autoPadding
                            ? 'scale-[0.8]'
                            : 'scale-[1.0]'
                        ]"
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
                        >{{ spec.id.includes('maskable') ? 'Maskable' : spec.platform }}</span
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
        <section class="space-y-5">
          <AppSectionHeader title="外观配置" :icon="Monitor" />
          <div class="px-1 space-y-6">
            <div class="space-y-4">
              <div class="flex flex-col gap-1 px-1">
                <span class="text-[10px] font-black text-muted-foreground uppercase tracking-widest"
                  >背景填充</span
                >
                <p class="text-[10px] text-muted-foreground/60 leading-relaxed">
                  若原始图标包含透明区域，可设置统一的底色。
                </p>
              </div>
              <div
                class="bg-muted/10 rounded-2xl p-4 border border-border/60 hover:border-border transition-colors"
              >
                <AppColorPicker v-model="backgroundColor" show-transparent :label="undefined" />
              </div>
            </div>
          </div>
        </section>

        <section class="space-y-5">
          <AppSectionHeader title="导出控制" :icon="Info" />
          <div class="px-1 space-y-8 pb-4 overflow-x-hidden">
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
              <div class="space-y-2">
                <div
                  v-for="spec in specs"
                  :key="spec.id"
                  @click="toggleSpec(spec.id)"
                  class="flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group select-none"
                  :class="
                    selectedIds.has(spec.id)
                      ? 'bg-primary/[0.03] border-primary/30 shadow-sm'
                      : 'bg-muted/5 border-border/40 hover:bg-muted/10'
                  "
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <div
                      v-if="spec.type !== 'image'"
                      class="shrink-0 text-muted-foreground/40 group-hover:text-primary/60 transition-colors"
                    >
                      <FileCode v-if="spec.type === 'config'" :size="14" />
                      <FileText v-else :size="14" />
                    </div>
                    <div class="flex flex-col gap-0.5 min-w-0">
                      <span class="text-[10px] font-bold text-foreground truncate">{{
                        spec.name
                      }}</span>
                      <span class="text-[9px] font-medium text-muted-foreground/60 leading-tight">{{
                        spec.description
                      }}</span>
                    </div>
                  </div>
                  <AppCheckbox
                    :model-value="selectedIds.has(spec.id)"
                    class="pointer-events-none"
                  />
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
                Android 建议图标关键内容（如文字、图形）应保持在
                <b>80% 中心圆区 (Safe Zone)</b> 内，其余区域作为背景以自适应各种裁切形状。
              </p>
            </div>

            <AppTip>ZIP 将自动包含满足各商店审核要求的全套资源。</AppTip>
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
          导出 {{ selectedIds.size }} 个项目
        </AppButton>
      </InspectorFooter>
    </template>
  </WorkspaceLayout>
</template>
