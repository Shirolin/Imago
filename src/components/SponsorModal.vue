<script setup lang="ts">
import AppModal from './common/AppModal.vue'
import AppButton from './common/AppButton.vue'
import { Coffee, Heart, ExternalLink } from 'lucide-vue-next'

defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close'])
</script>

<template>
  <AppModal :show="show" title="支持 Imago" variant="dialog" @close="emit('close')">
    <div class="p-6 space-y-6">
      <div class="text-center space-y-2">
        <div
          class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <Heart class="text-primary animate-pulse" :size="32" fill="currentColor" />
        </div>
        <h3 class="text-xl font-black tracking-tight">赞助开发者</h3>
        <p class="text-sm text-muted-foreground leading-relaxed">
          如果您觉得 Imago
          对您有所帮助，欢迎通过以下方式支持本项目的持续开发与维护。您的支持是维持服务器运行和功能更新的动力。
        </p>
      </div>

      <div class="grid gap-3">
        <a
          href="https://www.buymeacoffee.com/shirolin"
          target="_blank"
          class="flex items-center justify-between p-4 bg-[#FFDD00]/10 hover:bg-[#FFDD00]/20 border border-[#FFDD00]/20 rounded-2xl transition-all group"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 bg-[#FFDD00] rounded-xl flex items-center justify-center text-black shadow-lg shadow-[#FFDD00]/20 group-hover:scale-110 transition-transform"
            >
              <Coffee :size="20" />
            </div>
            <div>
              <div class="font-bold text-sm">Buy Me a Coffee</div>
              <div
                class="text-[10px] text-[#FFDD00]/80 dark:text-[#FFDD00]/60 font-black uppercase tracking-wider"
              >
                International · 推荐
              </div>
            </div>
          </div>
          <ExternalLink
            :size="16"
            class="text-muted-foreground/40 group-hover:text-foreground transition-colors"
          />
        </a>

        <div class="p-4 bg-muted/30 border border-border/50 rounded-2xl">
          <div class="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">
            国内赞助方式
          </div>
          <p class="text-[11px] text-muted-foreground leading-relaxed">
            如果您希望通过微信或支付宝支持，请点击
            <a
              href="https://github.com/Shirolin/Imago"
              target="_blank"
              class="text-primary hover:underline font-bold"
              >GitHub 仓库</a
            >
            并在 README 中查看二维码（如有更新），或通过 Issue 与我取得联系。
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <AppButton variant="secondary" class="w-full h-11 rounded-xl" @click="emit('close')">
        关闭
      </AppButton>
    </template>
  </AppModal>
</template>
