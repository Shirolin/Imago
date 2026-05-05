# ImageCard 2.1 Implementation Plan (Magnifier Priority)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a balanced ImageCard redesign that prioritizes the magnifier in Large mode and the HUD in Compact mode.

**Architecture:** Reactive Vue component using Container Queries to toggle magnifier availability and button positioning. Stateless result management via local props.

**Tech Stack:** Vue 3, Tailwind CSS, Lucide Icons, CSS Container Queries.

---

### Task 1: Restore Magnifier Logic & Adaptive Props

**Files:**

- Modify: `src/components/common/ImageCard.vue`

- [ ] **Step 1: Re-implement the smooth magnifier logic in `<script setup>`.**

```typescript
// 智能倍镜逻辑
const showMagnifier = ref(false)
const mousePos = ref({ x: 50, y: 50 })
const originalHDUrl = ref<string | null>(null)
const localProcessedUrl = ref<string | null>(null)
const imageRef = ref<HTMLElement | null>(null)
const rafId = ref<number | null>(null)

// 只有在完成处理且悬停时才处理高清 URL
watch(showMagnifier, (isShowing) => {
  if (isShowing) {
    if (props.processedPreview) {
      localProcessedUrl.value = props.processedPreview
    } else if (props.processedBlob) {
      localProcessedUrl.value = URL.createObjectURL(props.processedBlob)
    }

    if (!originalHDUrl.value) {
      originalHDUrl.value = props.image.preview || URL.createObjectURL(props.image.file)
    }
  }
})

// 监听处理结果变化，实时更新倍镜
watch(
  () => props.processedPreview,
  (newUrl) => {
    if (showMagnifier.value && newUrl) {
      localProcessedUrl.value = newUrl
    }
  }
)

onUnmounted(() => {
  if (localProcessedUrl.value && localProcessedUrl.value !== props.processedPreview) {
    URL.revokeObjectURL(localProcessedUrl.value)
  }
  if (rafId.value) cancelAnimationFrame(rafId.value)
})

const handleMouseMove = (e: MouseEvent) => {
  if (!props.allowMagnifier || !showMagnifier.value || !imageRef.value) return

  if (rafId.value) cancelAnimationFrame(rafId.value)

  rafId.value = requestAnimationFrame(() => {
    const rect = imageRef.value!.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    mousePos.value = { x, y }
  })
}

const enterMagnifier = () => {
  // 【新】：仅在大图模式且完成处理时允许进入倍镜
  if (props.allowMagnifier && props.image.status === 'done' && store.showMagnifier) {
    const isLarge = imageRef.value?.clientWidth ? imageRef.value.clientWidth > 220 : true
    if (isLarge) showMagnifier.value = true
  }
}

const leaveMagnifier = () => {
  showMagnifier.value = false
}

// ... include innerContainerStyle and dynamicClipPath computed properties ...
```

- [ ] **Step 2: Commit Task 1**

---

### Task 2: Implement Modal-Driven Layout (Magnifier vs HUD)

**Files:**

- Modify: `src/components/common/ImageCard.vue`

- [ ] **Step 1: Update the template to toggle between Magnifier (Large) and HUD Tray (Small).**

```vue
<!-- Layer 1: Canvas -->
<div ref="imageRef" @mouseenter="enterMagnifier" @mouseleave="leaveMagnifier" @mousemove="handleMouseMove">
   <!-- Preview & Overlays (Checkbox, X) -->
   ...

   <!-- Magnifier Layer: Only visible in Large Mode -->
   <div v-if="showMagnifier && localProcessedUrl && originalHDUrl" class="hidden @[221px]:block absolute inset-0 z-40 pointer-events-none">
      <!-- Magnifier UI ... -->
   </div>

   <!-- HUD Tray Layer: Only visible in Small Mode on Hover -->
   <div class="block @[221px]:hidden absolute bottom-3 left-3 right-3 z-30 bg-background/80 backdrop-blur-xl rounded-xl p-1.5 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
      <!-- Buttons for Small Mode -->
   </div>
</div>

<!-- Layer 2: Info Area -->
<div>
   <!-- Filename & Status -->
   ...

   <!-- Large Mode Action Bar: Only visible in Large Mode -->
   <div class="hidden @[221px]:flex items-center justify-between gap-1 mt-auto pt-2.5">
      <!-- Full Buttons for Large Mode -->
   </div>
</div>
```

- [ ] **Step 2: Commit Task 2**

---

### Task 3: Final Polish & Verification

- [ ] **Step 1: Restore Dirty state visual logic.**
- [ ] **Step 2: Run all technical checks.**
- [ ] **Step 3: Verification in browser.**
