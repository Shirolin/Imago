import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 工具 CTA 文案键的真源。
 *
 * 此前 buttonLabelFit.test.ts 里是一份手抄清单，只覆盖 22 个 key，
 * 而src/views 实际使用 36 个——新增工具的 CTA 拿不到字数预算门禁，
 * 只有等按钮在窄屏溢出才会被发现。改为从视图源码派生：
 * 新增视图用了新的 t('tools.*.cta.*') 会被自动纳入预算检查。
 *
 * 派生而非硬编码的代价是测试要读源文件；这在本仓库已有先例
 * （segmentLabelKeys 同样是为门禁而存在的键清单）。
 */

const VIEWS_DIR = join(process.cwd(), 'src/views')

const CTA_KEY_RE = /t\('(tools\.[\w]+\.cta\.[\w]+)'/g

let cached: string[] | null = null

/** 扫描视图源码，取出全部 tools.*.cta.* 键（去重、排序，保证顺序稳定） */
export function collectCtaLabelKeys(): string[] {
  if (cached) return cached
  const found = new Set<string>()
  let files: string[] = []
  try {
    files = readdirSync(VIEWS_DIR).filter((f) => f.endsWith('.vue'))
  } catch {
    cached = []
    return cached
  }
  for (const file of files) {
    const source = readFileSync(join(VIEWS_DIR, file), 'utf-8')
    for (const match of source.matchAll(CTA_KEY_RE)) {
      const key = match[1]
      if (key) found.add(key)
    }
  }
  cached = [...found].sort()
  return cached
}

/**
 * 「点击中止」提示：出现在处理中 CTA 的 hint 位，预算更紧。
 * Filters / BgRemove / Combine 目前借用 tools.split 下的键，属已知的历史沿用。
 */
export const CTA_ABORT_HINT_KEYS = ['tools.split.cta.clickToAbort'] as const

/**
 * 分段控件外的独立 CTA（不计入工具 CTA 清单）。
 * 这些是工具栏/弹窗/导航上的动作按钮，语境不同、预算也不同。
 */
export const CTA_OTHER_KEYS = [
  'common.image.toolbar.import',
  'common.image.toolbar.exportAll',
  'common.image.toolbar.confirm',
  'common.image.toolbar.deleteSelected',
  'common.image.toolbar.clearAll',
  'common.modal.download.confirm',
  'tools.favicon.cta',
  // 工具内动作按钮：语义与 CTA 不同，但同样受 fill 宽度预算约束
  'tools.split.syncGrid',
  'tools.split.clearAll',
  'tools.crop.fillAll',
  'tools.crop.undo',
  'tools.crop.redo'
] as const
