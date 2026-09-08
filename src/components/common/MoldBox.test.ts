import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MoldBox from './MoldBox.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

function firePointer(
  target: Element | Window,
  type: string,
  opts: { button?: number; clientX?: number; clientY?: number } = {}
) {
  // test-utils trigger() 把 pointerdown 映射为只读 getter 的 MouseEvent，直接构造可写事件
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 0,
      clientY: 0,
      ...opts
    })
  )
}

function fireWindowMove(x: number, y: number) {
  firePointer(window, 'pointermove', { clientX: x, clientY: y })
}

function mountBox() {
  return mount(MoldBox, {
    props: {
      imageUrl: 'blob:mock',
      imageWidth: 200,
      imageHeight: 200,
      modelValue: { x: 10, y: 10, w: 32, h: 32 },
      scale: 1
    }
  })
}

describe('MoldBox 拖拽手势', () => {
  it('框体 pointerdown 后窗口 pointermove 触发位移', async () => {
    const wrapper = mountBox()
    firePointer(wrapper.find('[data-testid="mold-frame"]').element, 'pointerdown', {
      button: 0,
      clientX: 50,
      clientY: 50
    })
    await wrapper.vm.$nextTick()
    fireWindowMove(60, 70)
    const emitted = wrapper.emitted('update:modelValue') as unknown[][]
    expect(emitted?.length).toBeGreaterThan(0)
    expect(emitted?.[emitted.length - 1]?.[0]).toEqual({ x: 20, y: 30, w: 32, h: 32 })
    window.dispatchEvent(new Event('pointerup'))
    expect(wrapper.emitted('change')).toBeTruthy()
    wrapper.unmount()
  })

  it('右下手柄拖拽改变尺寸而非位置', async () => {
    const wrapper = mountBox()
    firePointer(wrapper.find('[data-testid="mold-handle-se"]').element, 'pointerdown', {
      button: 0,
      clientX: 0,
      clientY: 0
    })
    await wrapper.vm.$nextTick()
    fireWindowMove(8, 4)
    const emitted = wrapper.emitted('update:modelValue') as unknown[][]
    expect(emitted?.[emitted.length - 1]?.[0]).toEqual({ x: 10, y: 10, w: 40, h: 36 })
    wrapper.unmount()
  })

  it('非左键不启动手势', async () => {
    const wrapper = mountBox()
    firePointer(wrapper.find('[data-testid="mold-frame"]').element, 'pointerdown', {
      button: 2,
      clientX: 50,
      clientY: 50
    })
    await wrapper.vm.$nextTick()
    fireWindowMove(90, 90)
    expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    wrapper.unmount()
  })
})
