<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Upload, Image as ImageIcon, FileImage, MousePointer2 } from 'lucide-vue-next'
import AppButton from './AppButton.vue'

const emit = defineEmits(['upload'])
const isGlobalDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const handleFiles = (files: FileList | File[]) => {
  const MAX_SIZE = 50 * 1024 * 1024 // 50MB
  const validTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif',
    'image/svg+xml'
  ]

  const validFiles = Array.from(files).filter((file) => {
    if (!file.type.startsWith('image/') && !validTypes.includes(file.type)) {
      return false
    }
    if (file.size > MAX_SIZE) {
      alert(
        `图片 [${file.name}] 体积过大 (${(file.size / 1024 / 1024).toFixed(1)}MB)，已被拦截以免导致浏览器崩溃。最大支持 50MB。`
      )
      return false
    }
    return true
  })

  if (validFiles.length > 0) {
    emit('upload', validFiles)
  }
}

let dragTarget: EventTarget | null = null

const onGlobalDragEnter = (e: DragEvent) => {
  e.preventDefault()
  dragTarget = e.target
  isGlobalDragging.value = true
}

const onGlobalDragOver = (e: DragEvent) => {
  e.preventDefault()
}

const onGlobalDragLeave = (e: DragEvent) => {
  // Only hide if we leave the outer window/document
  if (e.target === dragTarget || e.target === document) {
    isGlobalDragging.value = false
  }
}

const onGlobalDrop = (e: DragEvent) => {
  e.preventDefault()
  isGlobalDragging.value = false
  if (e.dataTransfer?.files) {
    handleFiles(e.dataTransfer.files)
  }
}

const onFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    handleFiles(target.files)
  }
}

const onPaste = (e: ClipboardEvent) => {
  if (e.clipboardData?.files) {
    handleFiles(e.clipboardData.files)
  }
}

const triggerSelect = () => {
  fileInput.value?.click()
}

onMounted(() => {
  window.addEventListener('paste', onPaste)
  document.addEventListener('dragenter', onGlobalDragEnter)
  document.addEventListener('dragover', onGlobalDragOver)
  document.addEventListener('dragleave', onGlobalDragLeave)
  document.addEventListener('drop', onGlobalDrop)
})

onUnmounted(() => {
  window.removeEventListener('paste', onPaste)
  document.removeEventListener('dragenter', onGlobalDragEnter)
  document.removeEventListener('dragover', onGlobalDragOver)
  document.removeEventListener('dragleave', onGlobalDragLeave)
  document.removeEventListener('drop', onGlobalDrop)
})
</script>

<template>
  <div
    class="relative w-full min-h-[320px] md:min-h-[480px] bg-card border-2 border-dashed border-border rounded-3xl md:rounded-[40px] flex items-center justify-center cursor-pointer overflow-hidden p-6 md:p-8 outline-none transition-all duration-400 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20 hover:border-primary hover:bg-muted md:hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10 group @container"
    :class="{ 'border-primary bg-primary/10 scale-[0.985]': isGlobalDragging }"
    @click="triggerSelect"
  >
    <!-- 全局拖拽覆盖层 (Delight Overlay) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-105"
      >
        <div
          v-if="isGlobalDragging"
          class="fixed inset-4 bg-primary/20 backdrop-blur-xl z-[9999] flex items-center justify-center border-2 border-dashed border-primary/40 rounded-[2.5rem] pointer-events-none shadow-[0_0_80px_-20px_rgba(var(--primary),0.3)]"
        >
          <div
            class="flex flex-col items-center gap-8 text-primary animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div class="relative">
              <div class="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse"></div>
              <MousePointer2 :size="64" class="relative z-10 animate-bounce" stroke-width="2.5" />
            </div>
            <div class="flex flex-col items-center gap-2">
              <span class="font-black text-3xl md:text-4xl tracking-tighter uppercase"
                >Drop to Imago</span
              >
              <p class="text-primary/70 font-bold text-sm tracking-[0.2em] uppercase">
                Release to start processing
              </p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <input
      type="file"
      ref="fileInput"
      multiple
      accept="image/*"
      class="hidden"
      @change="onFileSelect"
    />

    <div
      class="relative z-10 flex flex-col items-center text-center w-full max-w-[min(90%,600px)] mx-auto py-4"
    >
      <!-- 插画图标区域 (Delightful Float) -->
      <div
        class="relative mb-10 md:mb-16 w-[clamp(120px,30cqw,160px)] aspect-[1.2/1] flex justify-center perspective-1000"
      >
        <div
          class="w-[60%] h-[80%] rounded-[24%] bg-card border-2 border-border text-primary flex items-center justify-center relative z-10 transition-all duration-500 group-hover:border-primary group-hover:scale-110 group-hover:-rotate-3 shadow-soft group-hover:shadow-primary/20"
        >
          <Upload class="w-1/2 h-1/2 transition-transform duration-500 group-hover:scale-110" />
        </div>
        <div
          class="absolute bottom-2 left-0 w-[35%] h-[45%] rounded-[22%] bg-muted/80 border-2 border-border text-muted-foreground/60 z-0 -rotate-12 flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:border-primary/40 group-hover:text-primary group-hover:-translate-x-6 group-hover:translate-y-2 group-hover:-rotate-[25deg] shadow-sm"
        >
          <ImageIcon class="w-1/2 h-1/2" />
        </div>
        <div
          class="absolute top-2 right-0 w-[35%] h-[45%] rounded-[22%] bg-muted/80 border-2 border-border text-muted-foreground/60 z-0 rotate-12 flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:border-primary/40 group-hover:text-primary group-hover:translate-x-6 group-hover:-translate-y-2 group-hover:rotate-[25deg] shadow-sm"
        >
          <FileImage class="w-1/2 h-1/2" />
        </div>
      </div>

      <!-- 文字内容区域 -->
      <div class="mb-10 md:mb-14 flex flex-col items-center w-full">
        <h2
          class="font-black text-foreground mb-4 md:mb-5 tracking-tight px-2 leading-[1.1] [text-wrap:balance]"
          style="font-size: clamp(1.5rem, 6cqw, 2.25rem)"
        >
          即刻开启您的<br /><span class="text-primary">图像处理之旅</span>
        </h2>
        <p
          class="text-muted-foreground font-medium leading-relaxed px-4 [text-wrap:balance] opacity-80"
          style="font-size: clamp(0.9rem, 3cqw, 1.05rem)"
        >
          拖拽、点击或粘贴图片 · <span class="text-foreground">100% 隐私安全</span>
        </p>
      </div>

      <!-- 快捷键提示 (Polished) -->
      <div
        class="hidden @[35rem]:flex items-center gap-6 mb-12 shrink-0 bg-muted/50 px-6 py-2.5 rounded-full border border-border/40"
      >
        <div
          class="flex items-center gap-2 text-[0.7rem] text-muted-foreground font-bold uppercase tracking-widest"
        >
          <kbd
            class="bg-background border-b-2 border-border/80 rounded px-2 py-0.5 text-[0.6rem] font-black"
            >Ctrl + V</kbd
          >
          Quick Paste
        </div>
        <div class="w-px h-3 bg-border/60"></div>
        <div
          class="flex items-center gap-2 text-[0.7rem] text-muted-foreground font-bold uppercase tracking-widest"
        >
          <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
          Pure Offline
        </div>
      </div>

      <AppButton
        size="lg"
        variant="cta"
        @click.stop="triggerSelect"
        class="!px-10 !h-14 !text-sm md:!text-base !rounded-2xl shrink-0 active:scale-95 transition-all duration-300"
      >
        <template #icon><Upload class="mr-2.5 w-5 h-5" /></template>
        选择文件
      </AppButton>
    </div>

    <!-- Background Pattern (Delightful Mesh) -->
    <div
      class="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none transition-opacity duration-500 group-hover:opacity-[0.05] dark:group-hover:opacity-[0.1]"
      style="
        background-image: radial-gradient(circle at 2px 2px, var(--foreground) 1px, transparent 0);
        background-size: 32px 32px;
      "
    ></div>
  </div>
</template>
