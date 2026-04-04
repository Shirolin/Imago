import JSZip from 'jszip'
import type { ProcessingOptions } from './types'

export interface FaviconSpec {
  id: string
  name: string
  size?: number
  platform: 'ios' | 'android' | 'web' | 'config' | 'chrome'
  description: string
  type: 'image' | 'config' | 'doc'
}

export const FAVICON_SPECS: FaviconSpec[] = [
  // Web 基础
  {
    id: 'ico',
    name: 'favicon.ico',
    size: 32,
    platform: 'web',
    description: '传统浏览器兼容 (32×32)',
    type: 'image'
  },
  {
    id: 'png16',
    name: 'favicon-16x16.png',
    size: 16,
    platform: 'web',
    description: '现代浏览器标签页 (16×16)',
    type: 'image'
  },
  {
    id: 'png32',
    name: 'favicon-32x32.png',
    size: 32,
    platform: 'web',
    description: '现代浏览器标签页 (32×32)',
    type: 'image'
  },

  // Chrome 扩展商店
  {
    id: 'chrome128',
    name: 'icon-128.png',
    size: 128,
    platform: 'chrome',
    description: 'Chrome 商店展示 (128×128)',
    type: 'image'
  },
  {
    id: 'chrome48',
    name: 'icon-48.png',
    size: 48,
    platform: 'chrome',
    description: '扩展管理页面 (48×48)',
    type: 'image'
  },
  {
    id: 'chrome16',
    name: 'icon-16.png',
    size: 16,
    platform: 'chrome',
    description: '工具栏图标 (16×16)',
    type: 'image'
  },

  // 移动端 iOS
  {
    id: 'apple',
    name: 'apple-touch-icon.png',
    size: 180,
    platform: 'ios',
    description: 'iOS 主屏幕 (180×180)',
    type: 'image'
  },

  // 移动端 Android & PWA
  {
    id: 'android192',
    name: 'android-chrome-192x192.png',
    size: 192,
    platform: 'android',
    description: 'Android 应用 (192×192)',
    type: 'image'
  },
  {
    id: 'android512',
    name: 'android-chrome-512x512.png',
    size: 512,
    platform: 'android',
    description: 'Android 应用 (512×512)',
    type: 'image'
  },
  {
    id: 'maskable512',
    name: 'android-chrome-maskable-512x512.png',
    size: 512,
    platform: 'android',
    description: 'Android 可裁切图标',
    type: 'image'
  },

  // 配置与文档
  {
    id: 'manifest',
    name: 'site.webmanifest',
    platform: 'config',
    description: 'Android PWA 配置文件',
    type: 'config'
  },
  {
    id: 'readme',
    name: 'README.txt',
    platform: 'config',
    description: '部署与 HTML 引用指南',
    type: 'doc'
  }
]

export interface FaviconResult {
  zip: Blob
}

export interface FaviconOptions extends ProcessingOptions {
  backgroundColor?: string
  selectedIds: Set<string>
  autoPadding: boolean
}

export const faviconEngine = {
  async generateSuite(file: File, options: FaviconOptions): Promise<FaviconResult> {
    const zip = new JSZip()
    const img = await this.loadImage(file)
    const { backgroundColor = 'transparent', selectedIds, autoPadding } = options

    // 1. 生成选中的图片
    for (const spec of FAVICON_SPECS) {
      if (spec.type === 'image' && selectedIds.has(spec.id) && spec.size) {
        const isMaskable = spec.id.includes('maskable')
        const shouldScale = isMaskable && autoPadding
        const blob = await this.renderToBlob(img, spec.size, backgroundColor, shouldScale)
        zip.file(spec.name, blob)
      }
    }

    // 2. 动态生成 manifest.json
    if (selectedIds.has('manifest')) {
      const manifest: Record<string, unknown> = {
        name: 'Imago Generated App',
        short_name: 'App',
        icons: [] as Record<string, string>[],
        theme_color: backgroundColor === 'transparent' ? '#ffffff' : backgroundColor,
        background_color: backgroundColor === 'transparent' ? '#ffffff' : backgroundColor,
        display: 'standalone'
      }

      const pushIcon = (id: string, name: string, size: string, purpose?: string) => {
        if (selectedIds.has(id)) {
          ;(manifest.icons as Record<string, string>[]).push({
            src: `/${name}`,
            sizes: size,
            type: 'image/png',
            purpose: purpose || 'any'
          })
        }
      }

      pushIcon('android192', 'android-chrome-192x192.png', '192x192')
      pushIcon('android512', 'android-chrome-512x512.png', '512x512')
      pushIcon('maskable512', 'android-chrome-maskable-512x512.png', '512x512', 'maskable')

      zip.file('site.webmanifest', JSON.stringify(manifest, null, 2))
    }

    // 3. 生成帮助文档
    if (selectedIds.has('readme')) {
      let headCode = ''
      if (selectedIds.has('apple'))
        headCode += '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n'
      if (selectedIds.has('png32'))
        headCode += '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n'
      if (selectedIds.has('png16'))
        headCode += '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">\n'
      if (selectedIds.has('manifest'))
        headCode += '<link rel="manifest" href="/site.webmanifest">\n'
      if (selectedIds.has('ico')) headCode += '<link rel="shortcut icon" href="/favicon.ico">'

      const chromeGuide = selectedIds.has('chrome128')
        ? `\n\nChrome 扩展开发：\n-----------------\n在 manifest.json 中添加：\n"icons": {\n  "16": "icon-16.png",\n  "48": "icon-48.png",\n  "128": "icon-128.png"\n}`
        : ''

      const readme = `Imago Favicon 套件使用指南
==========================

1. 将生成的资源上传至项目根目录。
2. 在 HTML 的 <head> 标签中插入以下代码：

${headCode}${chromeGuide}

注意：路径请根据您的实际部署目录进行调整。`
      zip.file('README.txt', readme)
    }

    const content = await zip.generateAsync({ type: 'blob' })
    return { zip: content }
  },

  loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.src = URL.createObjectURL(file)
    })
  },

  renderToBlob(
    img: HTMLImageElement,
    size: number,
    bg: string,
    shouldScale = false
  ): Promise<Blob> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!

      if (bg !== 'transparent') {
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, size, size)
      }

      const sourceSize = Math.min(img.width, img.height)
      const sx = (img.width - sourceSize) / 2
      const sy = (img.height - sourceSize) / 2

      if (shouldScale) {
        const safeSize = size * 0.8
        const offset = (size - safeSize) / 2
        ctx.drawImage(img, sx, sy, sourceSize, sourceSize, offset, offset, safeSize, safeSize)
      } else {
        ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, size, size)
      }

      canvas.toBlob((blob) => resolve(blob!), 'image/png', 1.0)
    })
  }
}
