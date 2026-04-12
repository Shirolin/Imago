<script setup lang="ts">
import AppModal from './common/AppModal.vue'
import AppButton from './common/AppButton.vue'
import { Coffee, Heart, ExternalLink, Zap, Github } from 'lucide-vue-next'

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
        <!-- GitHub -->
        <a
          href="https://github.com/Shirolin/Imago"
          target="_blank"
          class="flex items-center justify-between p-4 bg-foreground/5 hover:bg-foreground/10 border border-border/50 rounded-2xl transition-all group"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 bg-foreground rounded-xl flex items-center justify-center text-background shadow-lg group-hover:scale-110 transition-transform"
            >
              <Github :size="20" />
            </div>
            <div>
              <div class="font-bold text-sm">GitHub 仓库</div>
              <div class="text-[10px] text-muted-foreground font-black uppercase tracking-wider">
                开源代码 · Star ⭐ 支持
              </div>
            </div>
          </div>
          <ExternalLink
            :size="16"
            class="text-muted-foreground/40 group-hover:text-foreground transition-colors"
          />
        </a>

        <!-- 爱发电 -->
        <a
          href="https://ifdian.net/a/shirolin"
          target="_blank"
          class="flex items-center justify-between p-4 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-2xl transition-all group"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform"
            >
              <Zap :size="20" fill="currentColor" />
            </div>
            <div>
              <div class="font-bold text-sm text-purple-600 dark:text-purple-400">
                爱发电 (Afdian)
              </div>
              <div class="text-[10px] text-muted-foreground font-black uppercase tracking-wider">
                支持微信、支付宝 · 推荐
              </div>
            </div>
          </div>
          <ExternalLink
            :size="16"
            class="text-muted-foreground/40 group-hover:text-foreground transition-colors"
          />
        </a>

        <!-- Ko-fi -->
        <a
          href="https://ko-fi.com/shirolin"
          target="_blank"
          class="flex items-center justify-between p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-2xl transition-all group"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform"
            >
              <Coffee :size="20" />
            </div>
            <div>
              <div class="font-bold text-sm text-blue-600 dark:text-blue-400">Ko-fi</div>
              <div class="text-[10px] text-muted-foreground font-black uppercase tracking-wider">
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
            关于项目
          </div>
          <p class="text-[11px] text-muted-foreground leading-relaxed">
            Imago 是一款开源的本地化图片处理工具。您的支持（无论是通过 Star
            还是赞助）都将帮助项目变得更好。
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
