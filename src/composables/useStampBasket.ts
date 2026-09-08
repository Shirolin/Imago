import { ref, computed } from 'vue'
import { MAX_BASKET, buildStampBaseName, type MoldRect } from '../lib/moldCut'

export interface StampItem {
  id: string
  /** 导出基名：{原名}_{x}_{y}_{w}x{h} */
  name: string
  x: number
  y: number
  w: number
  h: number
  blob: Blob
  preview: string
  size: number
}

let seq = 0
function nextId(): string {
  seq += 1
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `stamp-${Date.now()}-${seq}`
}

/**
 * 模具切收集篮：内存暂存，上限 MAX_BASKET，不持久化。
 * 切图 / 刷新 / 清空即丢，卸载时必须调 clear() 释放 ObjectURL。
 */
export function useStampBasket() {
  const items = ref<StampItem[]>([])
  /** 篮归属的图片 id，切图即清空，防止跨图混篮 */
  const sourceId = ref<string | null>(null)

  const count = computed(() => items.value.length)
  const isFull = computed(() => items.value.length >= MAX_BASKET)

  const revoke = (item: StampItem) => URL.revokeObjectURL(item.preview)

  /** 满篮返回 null，调用方提示删后再盖 */
  function addStamp(blob: Blob, originalName: string, mold: MoldRect): StampItem | null {
    if (isFull.value) return null
    const item: StampItem = {
      id: nextId(),
      name: buildStampBaseName(originalName, mold),
      x: mold.x,
      y: mold.y,
      w: mold.w,
      h: mold.h,
      blob,
      preview: URL.createObjectURL(blob),
      size: blob.size
    }
    items.value.push(item)
    return item
  }

  function removeStamp(id: string): void {
    const idx = items.value.findIndex((s) => s.id === id)
    if (idx === -1) return
    const [item] = items.value.splice(idx, 1)
    if (item) revoke(item)
  }

  function clear(): void {
    items.value.forEach(revoke)
    items.value = []
  }

  /** 绑定归属图：切图时清空旧篮 */
  function bindSource(id: string | null): void {
    if (sourceId.value !== id) {
      clear()
      sourceId.value = id
    }
  }

  return { items, count, isFull, sourceId, addStamp, removeStamp, clear, bindSource }
}
