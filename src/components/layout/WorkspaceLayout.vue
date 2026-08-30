<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useImageStore } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'
import { useI18n } from 'vue-i18n'
import ImageUpload from '../common/ImageUpload.vue'
import AssetsTray from './AssetsTray.vue'
import { PanelRightClose, PanelRightOpen, ChevronUp, ChevronDown } from 'lucide-vue-next'
import { useBreakpoints } from '../../composables/useBreakpoints'
import { inspectorIsCollapsed as resolveInspectorCollapsed } from '../../composables/inspectorChrome'
import { useImageImport } from '../../composables/useImageImport'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { t } = useI18n()
const { importImages } = useImageImport()
const { isPhoneChrome, isTabletChrome, isUltra, isDesktop, isOverlayChrome, inspectorChromeMode } =
  useBreakpoints()

interface Props {
  showSidebar?: boolean
  noScroll?: boolean
  showAssetsTray?: boolean
}

defineProps<Props>()

const isMounted = ref(false)
const overlayInspectorCollapsed = ref(true)

const inspectorIsCollapsed = computed(() =>
  resolveInspectorCollapsed({
    chrome: inspectorChromeMode.value,
    overlayCollapsed: overlayInspectorCollapsed.value,
    storeCollapsed: layoutStore.isInspectorCollapsed
  })
)

const inspectorContentIsolated = computed(() => inspectorIsCollapsed.value && isOverlayChrome.value)

watch(inspectorChromeMode, (mode) => {
  if (mode === 'phone' || mode === 'tablet') overlayInspectorCollapsed.value = true
})

const toggleInspector = () => {
  if (isOverlayChrome.value) {
    overlayInspectorCollapsed.value = !overlayInspectorCollapsed.value
  } else {
    layoutStore.toggleInspector()
  }
}

onMounted(() => {
  isMounted.value = true
})
</script>

<template>
  <div class="h-full flex flex-col relative bg-[var(--paper)] overflow-hidden">
    <div
      class="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative w-full max-w-full"
    >
      <Teleport to="#top-bar-left" v-if="isMounted">
        <slot name="header-left"></slot>
      </Teleport>

      <Teleport to="#top-bar-center" v-if="isMounted">
        <slot name="header-actions"></slot>
      </Teleport>

      <Teleport to="#top-bar-right" v-if="isMounted">
        <button
          v-if="showSidebar"
          @click="toggleInspector"
          class="flex h-10 w-10 items-center justify-center rounded-[var(--radius-ctrl)] text-[var(--muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          :aria-label="t('common.layout.toggleInspector')"
          :aria-expanded="!inspectorIsCollapsed"
        >
          <PanelRightOpen v-if="inspectorIsCollapsed" :size="16" />
          <PanelRightClose v-else :size="16" />
        </button>
      </Teleport>

      <main
        class="flex-1 flex flex-col min-w-0 min-h-0 relative z-10 bg-[var(--paper)] overflow-hidden p-3"
        role="main"
        :inert="(isPhoneChrome || isTabletChrome) && !inspectorIsCollapsed ? true : undefined"
        :aria-hidden="(isPhoneChrome || isTabletChrome) && !inspectorIsCollapsed"
        :class="[
          isPhoneChrome ? 'imago-phone-drawer' : '',
          isPhoneChrome && showSidebar && !inspectorIsCollapsed
            ? 'pb-[var(--inspector-drawer-h)]'
            : '',
          isPhoneChrome && showSidebar && inspectorIsCollapsed
            ? 'pb-[var(--inspector-peek-h)]'
            : '',
          !isPhoneChrome ? 'pb-3' : ''
        ]"
      >
        <div
          v-if="store.images.length === 0"
          class="flex-1 min-h-0 imago-well flex items-center justify-center"
        >
          <ImageUpload @upload="importImages" />
        </div>

        <template v-else>
          <div
            class="flex-1 relative min-h-0 w-full imago-well"
            :style="{
              overscrollBehavior: isPhoneChrome && !inspectorIsCollapsed ? 'contain' : 'auto'
            }"
            :class="[
              noScroll
                ? 'overflow-hidden'
                : 'overflow-y-auto custom-scrollbar px-4 py-4 md:px-6 md:py-6',
              isUltra && !noScroll ? 'mx-auto max-w-[1600px]' : ''
            ]"
          >
            <div
              v-if="!noScroll"
              class="grid justify-center transition-all duration-200"
              :class="[
                layoutStore.cardSizeMode === 'compact'
                  ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 md:gap-4'
                  : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 md:gap-5'
              ]"
            >
              <slot name="content"></slot>
            </div>
            <slot v-else name="content"></slot>
          </div>

          <nav
            v-if="showAssetsTray && store.images.length > 1"
            class="shrink-0 w-0 min-w-full z-20 bg-[var(--board)] overflow-hidden"
            :aria-label="t('common.assets.trayAria')"
            :class="[
              (layoutStore.isAssetsTrayCollapsed && isDesktop) ||
              (isPhoneChrome && showSidebar && !inspectorIsCollapsed)
                ? 'h-0 border-t-0'
                : 'h-28 border-t border-[var(--hairline)]'
            ]"
          >
            <div
              class="h-full w-full relative group/tray-outer"
              @dblclick="isDesktop && layoutStore.toggleAssetsTray"
            >
              <div
                v-if="isDesktop"
                class="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-[var(--muted)]/30 rounded-[var(--radius)] mt-1 opacity-0 group-hover/tray-outer:opacity-100 transition-opacity cursor-ns-resize z-50 pointer-events-none"
              ></div>
              <AssetsTray />
            </div>
          </nav>

          <div
            v-if="
              isDesktop &&
              showAssetsTray &&
              store.images.length > 1 &&
              layoutStore.isAssetsTrayCollapsed
            "
            @click="layoutStore.toggleAssetsTray"
            class="h-8 bg-[var(--board)] cursor-pointer transition-colors border-t border-[var(--hairline)] shrink-0 group flex items-center justify-between px-4"
            :title="t('common.assets.expandTray')"
            role="button"
            tabindex="0"
            @keydown.enter.space.prevent="layoutStore.toggleAssetsTray"
          >
            <div class="flex-1"></div>
            <div class="flex items-center gap-2">
              <ChevronUp :size="14" class="text-[var(--muted)] group-hover:text-[var(--ink)]" />
              <span
                class="text-[11px] font-medium text-[var(--muted)] group-hover:text-[var(--ink)]"
                >{{ t('common.layout.showAssets') }}</span
              >
            </div>
            <div class="flex-1 flex justify-end">
              <div class="px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--muted)]">
                {{ store.images.length }}
              </div>
            </div>
          </div>
        </template>
      </main>

      <aside
        v-if="showSidebar"
        id="inspector-panel"
        class="imago-board border-[var(--hairline)] transition-all duration-200 lg:static"
        role="complementary"
        :aria-label="isPhoneChrome ? t('common.inspector.drawer') : t('common.inspector.sidebar')"
        :class="[
          isPhoneChrome ? 'imago-phone-drawer' : '',
          isPhoneChrome
            ? 'fixed bottom-0 left-0 right-0 h-[var(--inspector-drawer-h)] rounded-t-[var(--radius)] border-t z-[80] pb-[env(safe-area-inset-bottom,0px)]'
            : '',
          isPhoneChrome && inspectorIsCollapsed
            ? 'translate-y-[calc(100%-var(--inspector-peek-h))]'
            : '',

          isTabletChrome
            ? 'fixed top-[calc(2.75rem+env(safe-area-inset-top,0px))] right-3 bottom-3 w-[min(320px,calc(100vw-1.5rem))] rounded-[var(--radius)] border z-[80]'
            : '',
          isTabletChrome && inspectorIsCollapsed ? 'translate-x-[calc(100%+1rem)]' : '',

          isDesktop ? 'lg:h-auto lg:z-[60] lg:rounded-none lg:border-l' : '',
          isDesktop && inspectorIsCollapsed
            ? 'lg:w-0 lg:overflow-hidden lg:border-l-0'
            : 'lg:w-[280px] 2xl:w-[320px]'
        ]"
      >
        <div class="h-full flex flex-col w-full overflow-hidden relative">
          <div
            v-if="isPhoneChrome"
            @click="toggleInspector"
            class="flex flex-col items-center justify-center h-10 min-h-10 shrink-0 cursor-pointer group bg-[var(--board)] border-b border-[var(--hairline)]"
            role="button"
            :aria-label="
              inspectorIsCollapsed
                ? t('common.layout.expandPanel')
                : t('common.layout.collapsePanel')
            "
          >
            <div
              class="w-10 h-1 bg-[var(--muted)]/40 rounded-[var(--radius)] group-hover:bg-[var(--muted)]"
            ></div>
            <div class="mt-1 flex items-center justify-center h-4">
              <ChevronUp v-if="inspectorIsCollapsed" :size="14" class="text-[var(--muted)]" />
              <ChevronDown v-else :size="14" class="text-[var(--muted)]" />
            </div>
          </div>

          <div
            v-if="isTabletChrome || isDesktop"
            class="h-11 flex items-center justify-between px-4 border-b border-[var(--hairline)] shrink-0"
            :inert="inspectorIsCollapsed && isTabletChrome ? true : undefined"
            :aria-hidden="inspectorIsCollapsed && isTabletChrome ? true : undefined"
          >
            <span class="text-[13px] font-medium text-[var(--ink)]">{{
              t('common.inspector.spec')
            }}</span>
            <button
              v-if="isTabletChrome"
              @click="toggleInspector"
              class="flex h-10 w-10 items-center justify-center hover:bg-secondary rounded-[var(--radius)] transition-colors text-[var(--muted)] hover:text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              :aria-label="t('common.layout.closePanel')"
            >
              <PanelRightClose :size="16" />
            </button>
          </div>

          <div
            class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar w-full"
            :class="{
              'opacity-0': inspectorIsCollapsed && isPhoneChrome,
              'pointer-events-none': inspectorContentIsolated
            }"
            :inert="inspectorContentIsolated ? true : undefined"
            :aria-hidden="inspectorContentIsolated ? true : undefined"
          >
            <div class="p-4 flex flex-col gap-6 pb-8">
              <slot name="sidebar"></slot>
            </div>
          </div>

          <div
            v-if="!inspectorIsCollapsed && $slots.toolbar"
            class="shrink-0 px-3 py-2 border-t border-[var(--hairline)] bg-[var(--board)]"
          >
            <slot name="toolbar"></slot>
          </div>

          <div v-if="!inspectorIsCollapsed" class="shrink-0 z-30">
            <slot name="footer"></slot>
          </div>
        </div>
      </aside>

      <div
        v-if="isTabletChrome && showSidebar && !inspectorIsCollapsed"
        @click="toggleInspector"
        class="fixed inset-0 bg-[var(--paper)]/50 z-[70]"
      ></div>
    </div>
  </div>
</template>
