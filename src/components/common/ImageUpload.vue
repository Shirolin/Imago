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
    <!-- ... Teleport stays the same ... -->
    <Teleport to="body">
      <div
        v-if="isGlobalDragging"
        class="fixed inset-3 bg-primary/15 backdrop-blur-md z-[9999] flex items-center justify-center border-4 border-dashed border-primary rounded-2xl md:rounded-[38px] pointer-events-none animate-in fade-in zoom-in-95 duration-200"
      >
        <div
          class="flex flex-col items-center gap-6 text-primary font-extrabold text-2xl md:text-3xl drop-shadow-md text-center px-6 [text-wrap:balance]"
        >
          <MousePointer2 :size="48" class="md:w-16 md:h-16 animate-bounce" />
          <span>松开鼠标，将图片放入 Imago</span>
        </div>
      </div>
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
      class="relative z-10 flex flex-col items-center text-center w-full max-w-[min(90%,600px)] mx-auto"
    >
      <!-- 插画图标区域 -->
      <div
        class="relative mb-8 md:mb-12 w-[clamp(100px,25cqw,140px)] aspect-[1.2/1] flex justify-center"
      >
        <div
          class="w-[60%] h-[80%] rounded-[20%] bg-background border-2 border-border text-primary flex items-center justify-center relative z-10 transition-all duration-400 group-hover:border-primary group-hover:scale-110 shadow-sm"
        >
          <Upload class="w-1/2 h-1/2" />
        </div>
        <div
          class="absolute bottom-0 left-0 w-[35%] h-[45%] rounded-[20%] bg-card border-2 border-border text-muted-foreground z-0 -rotate-12 flex items-center justify-center transition-all duration-400 group-hover:border-primary group-hover:text-primary group-hover:-translate-x-2.5 group-hover:translate-y-1 group-hover:-rotate-[20deg]"
        >
          <ImageIcon class="w-1/2 h-1/2" />
        </div>
        <div
          class="absolute top-0 right-0 w-[35%] h-[45%] rounded-[20%] bg-card border-2 border-border text-muted-foreground z-0 rotate-12 flex items-center justify-center transition-all duration-400 group-hover:border-primary group-hover:text-primary group-hover:translate-x-2.5 group-hover:-translate-y-1 group-hover:rotate-[20deg]"
        >
          <FileImage class="w-1/2 h-1/2" />
        </div>
      </div>

      <!-- 文字内容区域 -->
      <div class="mb-8 md:mb-10 flex flex-col items-center w-full">
        <h2
          class="font-extrabold text-foreground mb-3 md:mb-4 tracking-tight px-2 leading-[1.2] [text-wrap:balance] hyphens-auto"
          style="font-size: clamp(1.25rem, 5cqw, 1.875rem)"
        >
          点击、拖拽或粘贴图片到这里
        </h2>
        <p
          class="text-muted-foreground leading-relaxed px-4 [text-wrap:balance]"
          style="font-size: clamp(0.875rem, 3cqw, 1rem)"
        >
          支持 JPG, PNG, WebP 等格式 · 100% 本地处理
        </p>
      </div>

      <!-- 底部辅助说明 -->
      <div class="hidden @[30rem]:flex items-center gap-5 mb-12 shrink-0">
        <div class="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
          <kbd
            class="bg-background border border-border rounded-md px-1.5 py-0.5 shadow-[0_2px_0_var(--border)] font-sans"
            >Ctrl</kbd
          >
          +
          <kbd
            class="bg-background border border-border rounded-md px-1.5 py-0.5 shadow-[0_2px_0_var(--border)] font-sans"
            >V</kbd
          >
          粘贴
        </div>
        <div class="w-px h-4 bg-border"></div>
        <div class="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <span class="w-1.5 h-1.5 bg-primary rounded-full"></span>
          原生支持
        </div>
      </div>

      <AppButton
        size="lg"
        @click.stop="triggerSelect"
        class="!px-8 !h-12 md:!h-14 !text-sm md:!text-base !rounded-xl md:!rounded-2xl shrink-0"
        >选择图片文件</AppButton
      >
    </div>

    <!-- Background Pattern -->
    <div
      class="absolute inset-0 opacity-5 pointer-events-none"
      style="
        background-image: radial-gradient(var(--border) 1px, transparent 1px);
        background-size: 32px 32px;
      "
    ></div>
  </div>
</template>
