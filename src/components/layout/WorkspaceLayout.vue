<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useImageStore } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'
import { useI18n } from 'vue-i18n'
import ImageUpload from '../common/ImageUpload.vue'
import AssetsTray from './AssetsTray.vue'
import { PanelRightClose, PanelRightOpen, ChevronUp, ChevronDown } from 'lucide-vue-next'
import { useBreakpoints } from '../../composables/useBreakpoints'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { t } = useI18n()
const { isCompact, isMedium, isUltra, isDesktop } = useBreakpoints()

interface Props {
  showSidebar?: boolean
  noScroll?: boolean
  showAssetsTray?: boolean
}

defineProps<Props>()

const isMounted = ref(false)
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
          @click="layoutStore.toggleInspector"
          class="hidden lg:flex p-2 hover:bg-secondary rounded-[var(--radius)] transition-colors text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] min-h-[36px] min-w-[36px] items-center justify-center"
          :aria-label="t('common.layout.toggleInspector')"
          :aria-expanded="!layoutStore.isInspectorCollapsed"
        >
          <PanelRightOpen v-if="layoutStore.isInspectorCollapsed" :size="16" />
          <PanelRightClose v-else :size="16" />
        </button>
        <button
          v-if="showSidebar && !isDesktop"
          @click="layoutStore.toggleInspector"
          class="flex lg:hidden p-2 hover:bg-secondary rounded-[var(--radius)] transition-colors text-muted-foreground hover:text-foreground min-h-[36px] min-w-[36px] items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          :aria-label="t('common.layout.toggleInspector')"
          :aria-expanded="!layoutStore.isInspectorCollapsed"
        >
          <PanelRightOpen v-if="layoutStore.isInspectorCollapsed" :size="16" />
          <PanelRightClose v-else :size="16" />
        </button>
      </Teleport>

      <main
        class="flex-1 flex flex-col min-w-0 min-h-0 relative z-10 bg-[var(--paper)] overflow-hidden p-3"
        role="main"
        :inert="(isCompact || isMedium) && !layoutStore.isInspectorCollapsed ? true : undefined"
        :aria-hidden="(isCompact || isMedium) && !layoutStore.isInspectorCollapsed"
        :class="[
          isCompact && showSidebar && !layoutStore.isInspectorCollapsed ? 'pb-[45vh]' : '',
          isCompact && showSidebar && layoutStore.isInspectorCollapsed ? 'pb-11' : '',
          !isCompact ? 'pb-3' : ''
        ]"
      >
        <div
          v-if="store.images.length === 0"
          class="flex-1 min-h-0 imago-well flex items-center justify-center"
        >
          <ImageUpload @upload="store.addImages" />
        </div>

        <template v-else>
          <div
            class="flex-1 relative min-h-0 w-full imago-well"
            :style="{
              overscrollBehavior:
                isCompact && !layoutStore.isInspectorCollapsed ? 'contain' : 'auto'
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
              (isCompact && showSidebar && !layoutStore.isInspectorCollapsed)
                ? 'h-0 border-t-0'
                : 'h-28 border-t border-[color-mix(in_srgb,var(--ink)_8%,transparent)]'
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
            class="h-8 bg-[var(--board)] cursor-pointer transition-colors border-t border-[color-mix(in_srgb,var(--ink)_8%,transparent)] shrink-0 group flex items-center justify-between px-4"
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
        class="imago-board border-[color-mix(in_srgb,var(--ink)_8%,transparent)] transition-all duration-200 z-[200] lg:static"
        role="complementary"
        :aria-label="isCompact ? t('common.inspector.drawer') : t('common.inspector.sidebar')"
        :class="[
          isCompact
            ? 'fixed bottom-0 left-0 right-0 h-[45vh] rounded-t-[var(--radius)] border-t z-[300]'
            : '',
          isCompact && layoutStore.isInspectorCollapsed ? 'translate-y-[calc(100%-44px)]' : '',

          isMedium
            ? 'fixed top-3 right-3 bottom-3 w-[320px] rounded-[var(--radius)] border z-[60]'
            : '',
          isMedium && layoutStore.isInspectorCollapsed
            ? 'translate-x-[calc(100%+1rem)]'
            : 'translate-x-0',

          isDesktop ? 'lg:h-auto lg:z-[60] lg:rounded-none lg:border-l' : '',
          isDesktop && layoutStore.isInspectorCollapsed
            ? 'lg:w-0 lg:overflow-hidden lg:border-l-0'
            : 'lg:w-[280px] 2xl:w-[320px]'
        ]"
      >
        <div class="h-full flex flex-col w-full overflow-hidden relative">
          <div
            v-if="isCompact"
            @click="layoutStore.toggleInspector"
            class="flex flex-col items-center justify-center h-10 shrink-0 cursor-pointer touch-none group bg-[var(--board)] border-b border-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
            role="button"
            :aria-label="
              layoutStore.isInspectorCollapsed
                ? t('common.layout.expandPanel')
                : t('common.layout.collapsePanel')
            "
          >
            <div
              class="w-10 h-1 bg-[var(--muted)]/40 rounded-[var(--radius)] group-hover:bg-[var(--muted)]"
            ></div>
            <div class="mt-1 flex items-center justify-center h-4">
              <ChevronUp
                v-if="layoutStore.isInspectorCollapsed"
                :size="14"
                class="text-[var(--muted)]"
              />
              <ChevronDown v-else :size="14" class="text-[var(--muted)]" />
            </div>
          </div>

          <div
            v-if="isMedium || isDesktop"
            class="h-10 flex items-center justify-between px-4 border-b border-[color-mix(in_srgb,var(--ink)_8%,transparent)] shrink-0"
          >
            <span class="text-[13px] font-medium text-[var(--ink)]">{{
              t('common.inspector.spec')
            }}</span>
            <button
              v-if="isMedium"
              @click="layoutStore.toggleInspector"
              class="p-1.5 hover:bg-secondary rounded-[var(--radius)] transition-colors text-[var(--muted)] hover:text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              :aria-label="t('common.layout.closePanel')"
            >
              <PanelRightClose :size="16" />
            </button>
          </div>

          <div
            class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar w-full"
            :class="{ 'opacity-0': layoutStore.isInspectorCollapsed && isCompact }"
          >
            <div class="p-4 flex flex-col gap-6 pb-8">
              <slot name="sidebar"></slot>
            </div>
          </div>

          <div
            v-if="!layoutStore.isInspectorCollapsed && $slots.toolbar"
            class="shrink-0 px-3 py-2 border-t border-[color-mix(in_srgb,var(--ink)_8%,transparent)] bg-[var(--board)]"
          >
            <slot name="toolbar"></slot>
          </div>

          <div v-if="!layoutStore.isInspectorCollapsed" class="shrink-0 z-30">
            <slot name="footer"></slot>
          </div>
        </div>
      </aside>

      <div
        v-if="isMedium && showSidebar && !layoutStore.isInspectorCollapsed"
        @click="layoutStore.toggleInspector"
        class="fixed inset-0 bg-[var(--paper)]/50 z-50"
      ></div>
    </div>
  </div>
</template>
