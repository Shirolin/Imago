import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useImageStore } from './imageStore'

describe('Image Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    // 模拟 Image 类以防止在 jsdom 中加载超时
    global.Image = class {
      set src(value: string) {
        setTimeout(() => this.onload(), 0)
      }
      onload = () => {}
      onerror = () => {}
      naturalWidth = 100
      naturalHeight = 100
    } as unknown as typeof Image
  })

  it('应该能正确导入图片', async () => {
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
    await store.addImages([mockFile])

    expect(store.images.length).toBe(1)
  })

  it('导入后自动选中新图片', async () => {
    const store = useImageStore()
    await store.addImages([
      new File(['1'], '1.png', { type: 'image/png' }),
      new File(['2'], '2.png', { type: 'image/png' })
    ])

    expect(store.selectedCount).toBe(2)
    expect(store.selectedIds.has(store.images[0]!.id)).toBe(true)
    expect(store.selectedIds.has(store.images[1]!.id)).toBe(true)
  })

  it('应该能正确切换选择状态', async () => {
    const store = useImageStore()
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' })
    await store.addImages([mockFile])
    const id = store.images[0]!.id

    expect(store.selectedIds.has(id)).toBe(true)
    expect(store.selectedCount).toBe(1)

    store.toggleSelection(id)
    expect(store.selectedIds.has(id)).toBe(false)

    store.toggleSelection(id)
    expect(store.selectedIds.has(id)).toBe(true)
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

  it('超长边图片应被拒绝导入', async () => {
    global.Image = class {
      set src(_value: string) {
        setTimeout(() => this.onload(), 0)
      }
      onload = () => {}
      onerror = () => {}
      naturalWidth = 20000
      naturalHeight = 1000
    } as unknown as typeof Image

    const store = useImageStore()
    const mockFile = new File(['test'], 'huge.png', { type: 'image/png' })
    const rejected = await store.addImages([mockFile])

    expect(rejected).toHaveLength(1)
    expect(rejected[0]!.reason).toBe('dimensions')
    expect(store.images.length).toBe(0)
    expect(vi.mocked(URL.revokeObjectURL)).toHaveBeenCalledWith('mock-url')
  })

  it('无法解码的图片应被拒绝导入', async () => {
    global.Image = class {
      set src(_value: string) {
        setTimeout(() => this.onerror(), 0)
      }
      onload = () => {}
      onerror = () => {}
      naturalWidth = 0
      naturalHeight = 0
    } as unknown as typeof Image

    const store = useImageStore()
    const mockFile = new File(['test'], 'broken.png', { type: 'image/png' })
    const rejected = await store.addImages([mockFile])

    expect(rejected).toHaveLength(1)
    expect(rejected[0]!.reason).toBe('decode')
    expect(store.images.length).toBe(0)
    expect(vi.mocked(URL.revokeObjectURL)).toHaveBeenCalledWith('mock-url')
  })
})
