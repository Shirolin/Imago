import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useImageStore } from './imageStore'

describe('Image Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 使用 spyOn 模拟 URL 方法，避免直接修改 readonly 属性导致的类型错误
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    // 模拟 Image 类以防止在 jsdom 中加载超时
    // @ts-ignore
    global.Image = class {
      // @ts-ignore
      set src(value: string) {
        // @ts-ignore
        setTimeout(() => this.onload(), 0)
      }
      onload = () => {}
      onerror = () => {}
      naturalWidth = 100
      naturalHeight = 100
    }
  })

  it('应该能正确添加图片', async () => {
    const store = useImageStore()
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' })

    await store.addImages([mockFile])

    expect(store.images.length).toBe(1)
    expect(store.images[0]!.file.name).toBe('test.png')
    expect(store.images[0]!.status).toBe('idle')
  })

  it('不应添加完全重复的文件', async () => {
    const store = useImageStore()
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' })

    await store.addImages([mockFile])
    await store.addImages([mockFile]) // 重复添加

    expect(store.images.length).toBe(1)
  })

  it('应该能正确切换选择状态', async () => {
    const store = useImageStore()
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' })
    await store.addImages([mockFile])
    const id = store.images[0]!.id

    store.toggleSelection(id)
    expect(store.selectedIds.has(id)).toBe(true)
    expect(store.selectedCount).toBe(1)

    store.toggleSelection(id)
    expect(store.selectedIds.has(id)).toBe(false)
  })

  it('应该能全选和取消全选', async () => {
    const store = useImageStore()
    await store.addImages([
      new File(['1'], '1.png', { type: 'image/png' }),
      new File(['2'], '2.png', { type: 'image/png' })
    ])

    store.selectAll()
    expect(store.selectedCount).toBe(2)
    expect(store.isAllSelected).toBe(true)

    store.deselectAll()
    expect(store.selectedCount).toBe(0)
    expect(store.isAllSelected).toBe(false)
  })

  it('移除图片时应清理资源', async () => {
    const store = useImageStore()
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' })
    await store.addImages([mockFile])
    const id = store.images[0]!.id

    store.removeImage(id)

    expect(store.images.length).toBe(0)
    expect(vi.mocked(URL.revokeObjectURL)).toHaveBeenCalledWith('mock-url')
  })
})
