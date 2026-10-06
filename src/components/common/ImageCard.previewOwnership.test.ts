import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import ImageCard from './ImageCard.vue'
import type { ImageItem } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'

/**
 * ImageCard 预览 URL 的所有权边界。
 *
 * localProcessedUrl 有两个来源：借自 props.processedPreview（归视图所有）与本组件
 * createObjectURL 出来的（归本组件所有）。此前 4 处释放点的守卫都比的是「新值」，
 * 于是用户打开过放大镜后再换结果时，借来的 URL 会被释放两次——视图仍要用它渲染卡片。
 * 现在释放权由 ownsLocalUrl 单一标记决定。
 */

const translate = (key: string) => key

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: translate }),
  // 模板里用的是全局 $t（AppButton / AppBadge 等子组件走这条）
  createI18n: () => ({ global: { t: translate } })
}))

function makeImage(): ImageItem {
  return {
    id: 'img-1',
    file: new File(['x'], 'a.png', { type: 'image/png' }),
    preview: 'blob:original',
    status: 'done',
    originalSize: 10,
    width: 100,
    height: 100,
    format: 'PNG'
  }
}

let created: string[]
let revoked: string[]

beforeEach(() => {
  setActivePinia(createPinia())
  useLayoutStore().cardSizeMode = 'large'
  created = []
  revoked = []
  let n = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    const url = `blob:mock-${++n}`
    created.push(url)
    return url
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    revoked.push(url as string)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function mountCard(props: Record<string, unknown>) {
  const wrapper = mount(ImageCard, {
    props: { image: makeImage(), isSelected: true, ...props },
    global: { mocks: { $t: translate } }
  })
  await nextTick()
  return wrapper
}

/** 打开放大镜：hover 画布容器（.group\\/canvas）。 */
async function openMagnifier(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('.group\\/canvas').trigger('mouseenter')
  await nextTick()
}

const revokesOf = (url: string) => revoked.filter((u) => u === url)

describe('ImageCard 预览 URL 所有权', () => {
  it('借来的 processedPreview 不被组件释放', async () => {
    const wrapper = await mountCard({ processedPreview: 'blob:view-owned' })

    await openMagnifier(wrapper)
    await wrapper.setProps({ processedPreview: 'blob:view-owned-2' })

    // 视图换了新的预览 URL，旧的那个归视图所有，组件无权释放
    expect(revokesOf('blob:view-owned')).toHaveLength(0)
    expect(created).toHaveLength(0)
  })

  it('组件自建的 URL 被释放一次，换结果与卸载都不重复', async () => {
    const wrapper = await mountCard({ processedBlob: new Blob(['a'], { type: 'image/png' }) })

    await openMagnifier(wrapper)
    expect(created).toHaveLength(1)
    const owned = created[0]!

    await wrapper.setProps({ processedBlob: new Blob(['b'], { type: 'image/png' }) })
    expect(revokesOf(owned)).toHaveLength(1)

    wrapper.unmount()
    // 卸载时该 URL 已被换掉，不应再释放第二次
    expect(revokesOf(owned)).toHaveLength(1)
  })

  it('借来的 URL 挂在组件上时，卸载也不释放', async () => {
    const wrapper = await mountCard({ processedPreview: 'blob:view-owned' })

    await openMagnifier(wrapper)
    wrapper.unmount()

    expect(revokesOf('blob:view-owned')).toHaveLength(0)
  })
})
