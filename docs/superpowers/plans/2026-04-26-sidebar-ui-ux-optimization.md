# Sidebar UI/UX Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the right sidebar (Inspector) to eliminate "AI slop" patterns, improve visual hierarchy, and enhance "pro-tool" aesthetics.

**Architecture:** Component-level refinement of typography, spacing, and visual depth across sidebar components.

**Tech Stack:** Vue 3, Tailwind CSS, Lucide Icons.

---

### Task 1: Refactor AppSectionHeader Typography & Icons

**Files:**
- Modify: `src/components/common/AppSectionHeader.vue`

- [ ] **Step 1: Update typography and icon container**

```vue
<template>
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-2.5">
      <div
        class="p-1.5 rounded-lg bg-primary/5 text-primary/80 shrink-0 flex items-center justify-center min-w-[28px] min-h-[28px] border border-primary/10"
      >
        <component v-if="icon" :is="icon" :size="14" stroke-width="2" />
      </div>
      <span class="font-semibold text-sm text-foreground/90 tracking-tight">{{
        title
      }}</span>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions"></slot>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit changes**

```bash
git add src/components/common/AppSectionHeader.vue
git commit -m "style(ui): refine AppSectionHeader typography and icon style"
```

---

### Task 2: Refactor AppSidebarCard for Depth

**Files:**
- Modify: `src/components/common/AppSidebarCard.vue`

- [ ] **Step 1: Update variant classes for better depth**

```typescript
const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-primary/5 border-primary/20 shadow-sm shadow-primary/5'
    case 'muted':
      return 'bg-muted/5 border-border/40'
    case 'default':
    default:
      return 'bg-card border-border/60 shadow-sm hover:border-primary/20 hover:shadow-md transition-all duration-300'
  }
})
```

- [ ] **Step 2: Update template padding**

```vue
<template>
  <div
    class="rounded-2xl p-4 md:p-5 border transition-all duration-300 overflow-hidden"
    :class="variantClasses"
  >
    <slot></slot>
  </div>
</template>
```

- [ ] **Step 3: Commit changes**

```bash
git add src/components/common/AppSidebarCard.vue
git commit -m "style(ui): enhance AppSidebarCard with depth and hover effects"
```

---

### Task 3: Refactor AppExportSettings Spacing & Labels

**Files:**
- Modify: `src/components/common/AppExportSettings.vue`

- [ ] **Step 1: Update group spacing and labels**

```vue
<!-- In src/components/common/AppExportSettings.vue -->
<template>
  <div class="space-y-8">
    <section class="space-y-5">
      <!-- ... Header ... -->
      <div class="space-y-5 px-1">
        <!-- ... Select ... -->
        <!-- ... SegmentedControl ... -->
        
        <div
          v-if="showQualitySlider || showTargetSizeInput || showPngOptions"
          class="bg-muted/10 rounded-2xl p-5 border border-border/40 mt-3 space-y-7"
        >
          <!-- A. 输出质量 -->
          <!-- B. 目标体积 -->
          <!-- C. PNG 选项 -->
        </div>
      </div>
    </section>

    <!-- 2. 进阶微调 -->
    <section v-if="showExifOption || allowManualQuality" class="space-y-5 pt-2 border-t border-border/40 @container">
      <!-- ... Advanced Toggle ... -->
      <!-- ... Advanced Content ... -->
    </section>
  </div>
</template>
```

- [ ] **Step 2: Refine micro-labels**

```vue
<!-- Change "RESOLUTION LIMIT" label style -->
<label class="text-xs font-medium text-muted-foreground/80 px-1">{{ t('common.export.resolutionLimit') }}</label>

<!-- Change Target Size label style in AppExportSettings.vue -->
<span class="text-xs font-medium text-muted-foreground/80 leading-none">{{ t('common.export.targetSize') }}</span>
```

- [ ] **Step 3: Commit changes**

```bash
git add src/components/common/AppExportSettings.vue
git commit -m "style(ui): optimize AppExportSettings spacing and typography"
```

---

### Task 4: Refactor InspectorFooter with Gradient Mask

**Files:**
- Modify: `src/components/layout/InspectorFooter.vue`

- [ ] **Step 1: Add gradient mask element**

```vue
<template>
  <div class="relative shrink-0 z-30">
    <!-- Gradient Fade Overlay -->
    <div class="absolute bottom-full left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none z-10"></div>
    
    <footer
      class="transition-all duration-300 relative"
      :class="[glass ? 'bg-card/95 backdrop-blur-md' : 'bg-card', showBorder ? 'border-t border-border/50' : '', padding]"
    >
      <div class="flex items-center gap-3 w-full">
        <slot></slot>
      </div>
    </footer>
  </div>
</template>
```

- [ ] **Step 2: Commit changes**

```bash
git add src/components/layout/InspectorFooter.vue
git commit -m "style(ui): add gradient mask to InspectorFooter"
```

---

### Task 5: Refactor WorkspaceLayout Sidebar Container

**Files:**
- Modify: `src/components/layout/WorkspaceLayout.vue`

- [ ] **Step 1: Update sidebar background and padding**

```vue
<!-- In src/components/layout/WorkspaceLayout.vue -->
<aside
  v-if="showSidebar"
  id="inspector-panel"
  class="bg-card/50 transition-all duration-500 ease-apple z-[200] lg:static shadow-2xl-up lg:shadow-none border-l border-border/40"
  <!-- ... -->
>
  <!-- ... -->
  <div class="p-5 md:p-6 flex flex-col gap-10 pb-10">
    <slot name="sidebar"></slot>
  </div>
  <!-- ... -->
</aside>
```

- [ ] **Step 2: Commit changes**

```bash
git add src/components/layout/WorkspaceLayout.vue
git commit -m "style(ui): refine WorkspaceLayout sidebar container"
```
