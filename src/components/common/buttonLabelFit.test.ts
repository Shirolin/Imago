import { describe, expect, it } from 'vitest'
import de from '../../locales/de.json'
import en from '../../locales/en.json'
import es from '../../locales/es.json'
import fr from '../../locales/fr.json'
import ja from '../../locales/ja.json'
import ko from '../../locales/ko.json'
import ptBR from '../../locales/pt-BR.json'
import tr from '../../locales/tr.json'
import zhCN from '../../locales/zh-CN.json'
import zhTW from '../../locales/zh-TW.json'

const locales = {
  de,
  en,
  es,
  fr,
  ja,
  ko,
  'pt-BR': ptBR,
  tr,
  'zh-CN': zhCN,
  'zh-TW': zhTW
} as const

type LocaleTree = string | { [key: string]: LocaleTree }

/** Inspector fill CTAs only (not inline/nowrap buttons like cover.start). */
const FILL_KEYS = [
  'common.image.toolbar.import',
  'common.image.toolbar.exportAll',
  'common.image.toolbar.confirm',
  'common.image.toolbar.deleteSelected',
  'common.image.toolbar.clearAll',
  'common.modal.download.confirm',
  'tools.compress.cta.startCompress',
  'tools.compress.cta.updateCompress',
  'tools.compress.cta.exportResults',
  'tools.compress.cta.rendering',
  'tools.compress.cta.selectImage',
  'tools.bgRemove.cta.export',
  'tools.bgRemove.cta.process',
  'tools.bgRemove.cta.processing',
  'tools.bgRemove.cta.select',
  'tools.split.cta.select',
  'tools.split.cta.rendering',
  'tools.filters.cta.select',
  'tools.filters.cta.rendering',
  'tools.combine.cta.processing',
  'tools.combine.cta.export',
  'tools.favicon.cta',
  'tools.resize.cta.select',
  'tools.split.verticalLine',
  'tools.split.horizontalLine',
  'tools.split.syncGrid',
  'tools.split.clearAll',
  'tools.crop.fillAll',
  'tools.crop.undo',
  'tools.crop.redo',
  'common.image.card.compare',
  'common.image.card.reset',
  'common.image.card.sam2'
]

/** Second-line abort hints rendered below fill CTAs during processing. */
const HINT_KEYS = ['tools.compress.cta.clickToAbort', 'tools.split.cta.clickToAbort']

const SEGMENT_KEYS = [
  'tools.bgRemove.engineMatch',
  'tools.bgRemove.enginePro',
  'tools.bgRemove.engineSmart',
  'tools.resize.byPercentage',
  'tools.resize.byDimensions',
  'tools.combine.dirVertical',
  'tools.combine.dirHorizontal',
  'tools.combine.grid',
  'tools.combine.smartScale',
  'tools.combine.originalSize',
  'common.export.qualityMode',
  'common.export.targetSizeMode'
]

const NAV_KEYS = [
  'nav.groups.core',
  'nav.groups.edit',
  'nav.groups.creative',
  'tools.compress.name',
  'tools.resize.name',
  'tools.crop.name',
  'tools.exif.name',
  'tools.split.name',
  'tools.combine.name',
  'tools.bgRemove.name',
  'tools.filters.name',
  'tools.favicon.name'
]

function lookup(tree: LocaleTree, path: string): string {
  const value = path.split('.').reduce<LocaleTree | undefined>((node, key) => {
    if (!node || typeof node === 'string') return undefined
    return node[key]
  }, tree)
  if (typeof value !== 'string') {
    throw new Error(`missing locale path ${path}`)
  }
  return value.replace(/\{[^}]+\}/g, '88')
}

/** Code-point width heuristic — not real Noto metrics; catches gross overflows only. */
function estimatePx(text: string, fontSize: number) {
  let width = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 32) width += fontSize * 0.28
    else if (code < 256) width += fontSize * 0.62
    else width += fontSize
  }
  return width
}

function fitsWrap(text: string, fontSize: number, lineBudget: number, lines: number) {
  return estimatePx(text, fontSize) <= lineBudget * lines
}

describe('button labels fit inspector chrome', () => {
  const fillLine = 190
  const segmentLine = 72
  const hintLine = 190

  for (const [locale, tree] of Object.entries(locales)) {
    it(`${locale} fill labels wrap within two 190px lines`, () => {
      const overflows: string[] = []
      for (const key of FILL_KEYS) {
        const text = lookup(tree as LocaleTree, key)
        if (!fitsWrap(text, 14, fillLine, 2)) {
          overflows.push(`${key} = "${text}" (${Math.round(estimatePx(text, 14))}px)`)
        }
      }
      expect(overflows, overflows.join('\n')).toEqual([])
    })

    it(`${locale} abort hints fit within one 190px line`, () => {
      const overflows: string[] = []
      for (const key of HINT_KEYS) {
        const text = lookup(tree as LocaleTree, key)
        if (!fitsWrap(text, 11, hintLine, 1)) {
          overflows.push(`${key} = "${text}" (${Math.round(estimatePx(text, 11))}px)`)
        }
      }
      expect(overflows, overflows.join('\n')).toEqual([])
    })

    it(`${locale} segmented labels wrap within two 72px lines`, () => {
      const overflows: string[] = []
      for (const key of SEGMENT_KEYS) {
        const text = lookup(tree as LocaleTree, key)
        if (!fitsWrap(text, 11, segmentLine, 2)) {
          overflows.push(`${key} = "${text}" (${Math.round(estimatePx(text, 11))}px)`)
        }
      }
      expect(overflows, overflows.join('\n')).toEqual([])
    })

    it(`${locale} nav labels wrap within two 172px lines`, () => {
      const overflows: string[] = []
      for (const key of NAV_KEYS) {
        const text = lookup(tree as LocaleTree, key)
        if (!fitsWrap(text, 14, 172, 2)) {
          overflows.push(`${key} = "${text}" (${Math.round(estimatePx(text, 14))}px)`)
        }
      }
      expect(overflows, overflows.join('\n')).toEqual([])
    })
  }
})
