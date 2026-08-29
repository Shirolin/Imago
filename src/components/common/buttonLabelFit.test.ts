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
import {
  CJK_LOCALES,
  FOOTER_SELECT_BUDGET,
  FOOTER_SELECT_KEYS,
  GRID_HALF_FILL_BUDGET,
  GRID_HALF_FILL_KEYS,
  MODEL_STATUS_LABEL_BUDGET,
  MODEL_STATUS_LABEL_KEYS,
  REFINER_HEADER_BUDGET,
  REFINER_HEADER_KEYS,
  FILTER_PRESET_BUDGET,
  FILTER_PRESET_KEYS,
  SEGMENT_BUDGET,
  SEGMENT_COLS5_KEYS,
  SEGMENT_LABEL_KEYS
} from '../../lib/segmentLabelKeys'

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
  'tools.split.syncGrid',
  'tools.split.clearAll',
  'tools.crop.fillAll',
  'tools.crop.undo',
  'tools.crop.redo',
  'common.image.card.compare',
  'common.image.card.reset',
  'common.image.card.sam2'
]

const HINT_KEYS = ['tools.compress.cta.clickToAbort', 'tools.split.cta.clickToAbort']

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

const FILL_BUDGET = { cjk: 26, latin: 36 } as const
const NAV_BUDGET = { cjk: 24, latin: 32 } as const
const HINT_BUDGET = { cjk: 16, latin: 22 } as const

const graphemeSegmenter = new (
  Intl as typeof Intl & {
    Segmenter: new (
      locales: string,
      options: { granularity: 'grapheme' }
    ) => { segment: (input: string) => Iterable<{ segment: string }> }
  }
).Segmenter('en', { granularity: 'grapheme' })

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

function graphemeCount(text: string): number {
  return [...graphemeSegmenter.segment(text)].length
}

function scriptForLocale(locale: string): 'cjk' | 'latin' {
  return CJK_LOCALES.has(locale) ? 'cjk' : 'latin'
}

function withinBudget(
  text: string,
  locale: string,
  budget: { cjk: number; latin: number }
): boolean {
  const limit = budget[scriptForLocale(locale)]
  return graphemeCount(text) <= limit
}

describe('button labels fit inspector chrome', () => {
  for (const [locale, tree] of Object.entries(locales)) {
    it(`${locale} fill labels within two-line grapheme budget`, () => {
      const overflows: string[] = []
      for (const key of FILL_KEYS) {
        const text = lookup(tree as LocaleTree, key)
        if (!withinBudget(text, locale, FILL_BUDGET)) {
          overflows.push(`${key} = "${text}" (${graphemeCount(text)} graphemes)`)
        }
      }
      expect(overflows, overflows.join('\n')).toEqual([])
    })

    it(`${locale} abort hints within single-line grapheme budget`, () => {
      const overflows: string[] = []
      for (const key of HINT_KEYS) {
        const text = lookup(tree as LocaleTree, key)
        if (!withinBudget(text, locale, HINT_BUDGET)) {
          overflows.push(`${key} = "${text}" (${graphemeCount(text)} graphemes)`)
        }
      }
      expect(overflows, overflows.join('\n')).toEqual([])
    })

    it(`${locale} segment labels fit 3-column single-line budget`, () => {
      const overflows: string[] = []
      for (const key of SEGMENT_LABEL_KEYS) {
        if (SEGMENT_COLS5_KEYS.has(key)) continue
        const text = lookup(tree as LocaleTree, key)
        if (!withinBudget(text, locale, SEGMENT_BUDGET.cols3)) {
          overflows.push(`${key} = "${text}" (${graphemeCount(text)} graphemes)`)
        }
      }
      expect(overflows, overflows.join('\n')).toEqual([])
    })

    it(`${locale} crop freeRatio fits 5-column single-line budget`, () => {
      const text = lookup(tree as LocaleTree, 'tools.crop.freeRatio')
      expect(
        withinBudget(text, locale, SEGMENT_BUDGET.cols5),
        `"${text}" (${graphemeCount(text)} graphemes)`
      ).toBe(true)
    })

    it(`${locale} footer select CTAs fit icon footer grapheme budget`, () => {
      const overflows: string[] = []
      for (const key of FOOTER_SELECT_KEYS) {
        const text = lookup(tree as LocaleTree, key)
        if (!withinBudget(text, locale, FOOTER_SELECT_BUDGET)) {
          overflows.push(`${key} = "${text}" (${graphemeCount(text)} graphemes)`)
        }
      }
      expect(overflows, overflows.join('\n')).toEqual([])
    })

    it(`${locale} half-width fill buttons fit grid grapheme budget`, () => {
      const overflows: string[] = []
      for (const key of GRID_HALF_FILL_KEYS) {
        const text = lookup(tree as LocaleTree, key)
        if (!withinBudget(text, locale, GRID_HALF_FILL_BUDGET)) {
          overflows.push(`${key} = "${text}" (${graphemeCount(text)} graphemes)`)
        }
      }
      expect(overflows, overflows.join('\n')).toEqual([])
    })

    it(`${locale} model status labels fit inspector single-line budget`, () => {
      const overflows: string[] = []
      for (const key of MODEL_STATUS_LABEL_KEYS) {
        const text = lookup(tree as LocaleTree, key)
        if (!withinBudget(text, locale, MODEL_STATUS_LABEL_BUDGET)) {
          overflows.push(`${key} = "${text}" (${graphemeCount(text)} graphemes)`)
        }
      }
      expect(overflows, overflows.join('\n')).toEqual([])
    })

    it(`${locale} refiner header labels fit inspector single-line budget`, () => {
      const overflows: string[] = []
      for (const key of REFINER_HEADER_KEYS) {
        const text = lookup(tree as LocaleTree, key)
        if (!withinBudget(text, locale, REFINER_HEADER_BUDGET)) {
          overflows.push(`${key} = "${text}" (${graphemeCount(text)} graphemes)`)
        }
      }
      expect(overflows, overflows.join('\n')).toEqual([])
    })

    it(`${locale} filter preset labels fit chip grapheme budget`, () => {
      const overflows: string[] = []
      for (const key of FILTER_PRESET_KEYS) {
        const text = lookup(tree as LocaleTree, key)
        if (!withinBudget(text, locale, FILTER_PRESET_BUDGET)) {
          overflows.push(`${key} = "${text}" (${graphemeCount(text)} graphemes)`)
        }
      }
      expect(overflows, overflows.join('\n')).toEqual([])
    })

    it(`${locale} nav labels within two-line grapheme budget`, () => {
      const overflows: string[] = []
      for (const key of NAV_KEYS) {
        const text = lookup(tree as LocaleTree, key)
        if (!withinBudget(text, locale, NAV_BUDGET)) {
          overflows.push(`${key} = "${text}" (${graphemeCount(text)} graphemes)`)
        }
      }
      expect(overflows, overflows.join('\n')).toEqual([])
    })
  }
})
