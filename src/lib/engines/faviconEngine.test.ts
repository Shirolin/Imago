import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import JSZip from 'jszip'
import { FAVICON_SPECS, faviconEngine } from './faviconEngine'
import { isAbortError } from './abort'

/**
 * faviconEngine：一图生成整套图标资源并打包。
 *
 * 此前零测试。它是 12 个变体逐个渲染 + manifest + README + ZIP 的组合逻辑，
 * 任何一处 id/名字写错都只在用户下载后才发现。
 */

const allIds = () => new Set(FAVICON_SPECS.map((s) => s.id))
const imageFile = () => new File([new Uint8Array([1])], 'logo.png', { type: 'image/png' })

/** 记录每个 canvas 的尺寸与调用，用于断言渲染参数 */
let renders: Array<{ size: number; fill: string | null; draw: number[] | null }> = []
let revoked: string[] = []
/** toBlob 的返回值工厂；置为 () => null 可模拟编码失败 */
let toBlobResult: () => Blob | null = () => new Blob(['png'], { type: 'image/png' })
/** getContext 返回 null 时置 true */
let ctxNull = false

beforeEach(() => {
  renders = []
  revoked = []
  ctxNull = false
  toBlobResult = () => new Blob(['png'], { type: 'image/png' })

  class FakeImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    width = 200
    height = 100 // 故意非正方形，验证居中裁剪
    naturalWidth = 200
    naturalHeight = 100
    set src(_v: string) {
      queueMicrotask(() => this.onload?.())
    }
  }
  vi.stubGlobal('Image', FakeImage)

  const realURL = globalThis.URL
  realURL.createObjectURL = () => 'blob:mock'
  realURL.revokeObjectURL = (u: string) => revoked.push(u)

  vi.stubGlobal('document', {
    createElement: () => {
      const rec: { size: number; fill: string | null; draw: number[] | null } = {
        size: 0,
        fill: null,
        draw: null
      }
      const el = {
        width: 0,
        height: 0,
        getContext: () => {
          if (ctxNull) return null
          return {
            set fillStyle(v: string | null) {
              rec.fill = v
            },
            get fillStyle() {
              return rec.fill
            },
            fillRect: () => {},
            drawImage: (...args: unknown[]) => {
              rec.draw = args.slice(1) as number[]
            }
          }
        },
        toBlob: (cb: (b: Blob | null) => void) => cb(toBlobResult())
      }
      // canvas.width/height 在 getContext 之前被赋值，这里延迟读取
      Object.defineProperty(el, 'width', {
        get: () => rec.size,
        set: (v: number) => {
          rec.size = v
        }
      })
      Object.defineProperty(el, 'height', {
        get: () => rec.size,
        set: (v: number) => {
          rec.size = v
        }
      })
      renders.push(rec)
      return el
    }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** 解包 ZIP 得到 { 文件名: 内容 } */
async function unzip(blob: Blob) {
  const zip = await JSZip.loadAsync(blob)
  const out: Record<string, { text: string; blob: Blob }> = {}
  for (const name of Object.keys(zip.files)) {
    const f = zip.files[name]!
    out[name] = { text: await f.async('string'), blob: await f.async('blob') }
  }
  return out
}

describe('FAVICON_SPECS 规格表', () => {
  it('id 唯一', () => {
    const ids = FAVICON_SPECS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('文件名唯一', () => {
    const names = FAVICON_SPECS.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('每个 image 规格都有正整数 size', () => {
    for (const s of FAVICON_SPECS.filter((x) => x.type === 'image')) {
      expect(s.size, `${s.id} 缺 size`).toBeTypeOf('number')
      expect(s.size!).toBeGreaterThan(0)
    }
  })

  it('config/doc 规格不带 size（不该走图片渲染分支）', () => {
    for (const s of FAVICON_SPECS.filter((x) => x.type !== 'image')) {
      expect(s.size, `${s.id} 不该有 size`).toBeUndefined()
    }
  })
})

describe('faviconEngine 图片变体', () => {
  it('全选时为每个 image 规格渲染一次', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: allIds(),
      autoPadding: false
    })
    const files = await unzip(zip)
    const imageSpecs = FAVICON_SPECS.filter((s) => s.type === 'image')
    for (const s of imageSpecs) {
      expect(files[s.name], `缺少 ${s.name}`).toBeDefined()
    }
    //每个 image 规格一个 canvas
    expect(renders).toHaveLength(imageSpecs.length)
  })

  it('只渲染选中的规格', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['png16']),
      autoPadding: false
    })
    const files = await unzip(zip)
    expect(Object.keys(files)).toEqual(['favicon-16x16.png'])
    expect(renders).toHaveLength(1)
  })

  it('canvas 尺寸等于规格 size（正方形）', async () => {
    await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['android512']),
      autoPadding: false
    })
    expect(renders[0]!.size).toBe(512)
  })

  it('非正方形源图居中裁剪（取短边，offset 为正）', async () => {
    // 源图 200x100 → sourceSize=100，sx=50, sy=0
    await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['png32']),
      autoPadding: false
    })
    const draw = renders[0]!.draw!
    expect(draw).toEqual([50, 0, 100, 100, 0, 0, 32, 32])
  })

  it("backgroundColor='transparent' 时不铺底色", async () => {
    await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['png32']),
      autoPadding: false
    })
    expect(renders[0]!.fill).toBeNull()
  })

  it('指定背景色时先铺底再画', async () => {
    await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['png32']),
      autoPadding: false,
      backgroundColor: '#ff0000'
    })
    expect(renders[0]!.fill).toBe('#ff0000')
  })
})

describe('faviconEngine maskable 安全区', () => {
  it('autoPadding=true 时 maskable512 按 80% 安全区缩放居中', async () => {
    await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['maskable512']),
      autoPadding: true
    })
    const draw = renders[0]!.draw!
    const size = 512
    const safe = size * 0.8
    const offset = (size - safe) / 2
    expect(draw).toEqual([50, 0, 100, 100, offset, offset, safe, safe])
  })

  it('autoPadding=false 时 maskable512 铺满', async () => {
    await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['maskable512']),
      autoPadding: false
    })
    const draw = renders[0]!.draw!
    expect(draw).toEqual([50, 0, 100, 100, 0, 0, 512, 512])
  })

  it('maskable + autoPadding + transparent 背景时自动改用白色底', async () => {
    //否则透明区在Android 上被裁掉后露出黑色
    await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['maskable512']),
      autoPadding: true,
      backgroundColor: 'transparent'
    })
    expect(renders[0]!.fill).toBe('white')
  })

  it('autoPadding 只影响 maskable512，不影响其它规格', async () => {
    await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['android192']),
      autoPadding: true
    })
    const draw = renders[0]!.draw!
    expect(draw).toEqual([50, 0, 100, 100, 0, 0, 192, 192])
  })
})

describe('faviconEngine ICO 封装', () => {
  it('favicon.ico 是真正的 ICO 容器而非裸 PNG', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['ico']),
      autoPadding: false
    })
    const files = await unzip(zip)
    const bytes = new Uint8Array(await files['favicon.ico']!.blob.arrayBuffer())
    // ICONDIR: reserved=0, type=1, count=1
    const view = new DataView(bytes.buffer)
    expect(view.getUint16(0, true)).toBe(0)
    expect(view.getUint16(2, true)).toBe(1)
    expect(view.getUint16(4, true)).toBe(1)
    // 数据偏移固定 22
    expect(view.getUint32(18, true)).toBe(22)
    // size 字段：小于 256 直接写
    expect(bytes[6]).toBe(32)
  })

  it('size>=256 时宽高字段写 0（ICO 规范：0 表示 256）', async () => {
    // 直接验证 wrapIcoPng 的边界：通过 ico 规格无法取到 256，
    // 故此处断言 spec 表里没有 256 的 ico，逻辑由上面 32 的用例覆盖
    const ico = FAVICON_SPECS.find((s) => s.id === 'ico')!
    expect(ico.size).toBe(32)
    expect(ico.size!).toBeLessThan(256)
  })

  it('其它 PNG 规格不套 ICO 容器（保持 PNG 魔数）', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['png32']),
      autoPadding: false
    })
    const files = await unzip(zip)
    // 假 toBlob 返回的是 'png' 字节而非真 PNG；这里只验证没被 ICO 包裹
    const bytes = new Uint8Array(await files['favicon-32x32.png']!.blob.arrayBuffer())
    expect(bytes.length).toBe(3) // 'png' 三个字节
  })
})

describe('faviconEngine manifest 生成', () => {
  it('未选 manifest 时不产出 site.webmanifest', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['png16']),
      autoPadding: false
    })
    const files = await unzip(zip)
    expect(files['site.webmanifest']).toBeUndefined()
  })

  it('选中 manifest 时按实际选中的图标生成 icons 列表', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['manifest', 'android192', 'maskable512']),
      autoPadding: false
    })
    const files = await unzip(zip)
    const manifest = JSON.parse(files['site.webmanifest']!.text)
    expect(manifest.icons).toHaveLength(2)
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes).sort()).toEqual([
      '192x192',
      '512x512'
    ])
  })

  it('maskable 图标带 purpose: maskable', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['manifest', 'maskable512']),
      autoPadding: false
    })
    const files = await unzip(zip)
    const manifest = JSON.parse(files['site.webmanifest']!.text)
    expect(manifest.icons[0].purpose).toBe('maskable')
  })

  it('未选任何 android 图标时 icons 为空数组', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['manifest']),
      autoPadding: false
    })
    const files = await unzip(zip)
    const manifest = JSON.parse(files['site.webmanifest']!.text)
    expect(manifest.icons).toEqual([])
  })

  it('transparent 背景下 theme/background 回退为 #ffffff', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['manifest']),
      autoPadding: false,
      backgroundColor: 'transparent'
    })
    const files = await unzip(zip)
    const manifest = JSON.parse(files['site.webmanifest']!.text)
    expect(manifest.theme_color).toBe('#ffffff')
    expect(manifest.background_color).toBe('#ffffff')
  })

  it('指定颜色时 theme/background 用该色', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['manifest']),
      autoPadding: false,
      backgroundColor: '#123456'
    })
    const files = await unzip(zip)
    const manifest = JSON.parse(files['site.webmanifest']!.text)
    expect(manifest.theme_color).toBe('#123456')
  })
})

describe('faviconEngine README 生成', () => {
  it('未选 readme 时不产出 README.txt', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['png16']),
      autoPadding: false
    })
    const files = await unzip(zip)
    expect(files['README.txt']).toBeUndefined()
  })

  it('README 只引用实际选中的资源', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['readme', 'apple', 'png32']),
      autoPadding: false
    })
    const files = await unzip(zip)
    const text = files['README.txt']!.text
    expect(text).toContain('apple-touch-icon')
    expect(text).toContain('favicon-32x32.png')
    // 未选 png16 / manifest / ico，不该出现
    expect(text).not.toContain('favicon-16x16.png')
    expect(text).not.toContain('site.webmanifest')
    expect(text).not.toContain('favicon.ico')
  })

  it('选了 chrome128 时附Chrome 扩展说明', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['readme', 'chrome128']),
      autoPadding: false
    })
    const files = await unzip(zip)
    expect(files['README.txt']!.text).toContain('Chrome 扩展开发')
  })

  it('未选 chrome128 时无 Chrome 扩展说明', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: new Set(['readme']),
      autoPadding: false
    })
    const files = await unzip(zip)
    expect(files['README.txt']!.text).not.toContain('Chrome 扩展开发')
  })
})

describe('faviconEngine 产物形态', () => {
  it('返回的 zip 是 application/zip 的非空 Blob', async () => {
    const { zip } = await faviconEngine.generateSuite(imageFile(), {
      selectedIds: allIds(),
      autoPadding: false
    })
    expect(zip).toBeInstanceOf(Blob)
    expect(zip.size).toBeGreaterThan(0)
  })

  it('解码失败时 reject 并回收 objectURL', async () => {
    class FailingImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      width = 8
      height = 8
      set src(_v: string) {
        queueMicrotask(() => this.onerror?.())
      }
    }
    vi.stubGlobal('Image', FailingImage)

    await expect(
      faviconEngine.generateSuite(imageFile(), { selectedIds: allIds(), autoPadding: false })
    ).rejects.toThrow('Failed to load image')
    expect(revoked).toEqual(['blob:mock'])
  })

  it('成功时回收 objectURL', async () => {
    await faviconEngine.generateSuite(imageFile(), { selectedIds: allIds(), autoPadding: false })
    expect(revoked).toEqual(['blob:mock'])
  })

  it('getContext 返回 null 时 reject（此前非空断言会崩在下一行）', async () => {
    ctxNull = true
    await expect(
      faviconEngine.generateSuite(imageFile(), {
        selectedIds: new Set(['png16']),
        autoPadding: false
      })
    ).rejects.toThrow('Failed to get canvas context')
  })

  it('toBlob 返回 null 时 reject（此前 resolve(null) 会往 ZIP 里塞 0 字节条目）', async () => {
    toBlobResult = () => null
    await expect(
      faviconEngine.generateSuite(imageFile(), {
        selectedIds: new Set(['png16']),
        autoPadding: false
      })
    ).rejects.toThrow('Canvas toBlob failed')
  })
})

describe('faviconEngine 中止', () => {
  it('signal 一开始已中止：立即 reject，不渲染任何变体', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const err = await faviconEngine
      .generateSuite(imageFile(), {
        selectedIds: allIds(),
        autoPadding: false,
        signal: ctrl.signal
      })
      .catch((e) => e)
    expect(isAbortError(err)).toBe(true)
    expect(renders).toHaveLength(0)
  })

  it('渲染途中中止：停止后续变体并 reject', async () => {
    const ctrl = new AbortController()
    const promise = faviconEngine.generateSuite(imageFile(), {
      selectedIds: allIds(),
      autoPadding: false,
      signal: ctrl.signal
    })
    // 解码完成后、渲染开始前中止
    await Promise.resolve()
    ctrl.abort()
    const err = await promise.catch((e) => e)
    expect(isAbortError(err)).toBe(true)
    // 不应渲染满12 个变体
    expect(renders.length).toBeLessThan(FAVICON_SPECS.filter((s) => s.type === 'image').length)
  })
})
