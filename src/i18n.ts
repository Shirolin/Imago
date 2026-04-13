import { createI18n } from 'vue-i18n'
import { useStorage } from '@vueuse/core'

import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import ptBR from './locales/pt-BR.json'
import tr from './locales/tr.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'

const messages = {
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
}

const defaultLocale = navigator.language || 'zh-CN'
const initialLocale = useStorage('imago-locale', defaultLocale).value

const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages
})

export default i18n
