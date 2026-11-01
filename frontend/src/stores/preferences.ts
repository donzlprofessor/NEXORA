import { i18n, tr, type Language } from '@/i18n'
import { defineStore } from 'pinia'
import { api } from '@/services/http'
import { nextTick, ref, watch } from 'vue'

export interface Preferences {
  name: string
  workspace: string
  language?: Language
  locale: 'en-IE' | 'de-DE' | 'pl-PL' | 'ru-RU'
  currencyDisplay: 'symbol' | 'code'
  theme: 'dark' | 'contrast'
  aiLanguage: Language
}
const defaults: Preferences = {
  language: 'en',
  name: 'Local User',
  workspace: 'Nexora Workspace',
  locale: 'en-IE',
  currencyDisplay: 'symbol',
  theme: 'dark',
  aiLanguage: 'en',
}
function load(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem('nexora_preferences') ?? '{}')
    return {
      language: ['en', 'pl', 'ru'].includes(value.language) ? value.language : 'en',
      name:
        typeof value.name === 'string' && value.name.trim()
          ? value.name.slice(0, 80)
          : defaults.name,
      workspace:
        typeof value.workspace === 'string' && value.workspace.trim()
          ? value.workspace.slice(0, 80)
          : defaults.workspace,
      locale: ['en-IE', 'de-DE', 'pl-PL', 'ru-RU'].includes(value.locale)
        ? value.locale
        : defaults.locale,
      currencyDisplay: value.currencyDisplay === 'code' ? 'code' : 'symbol',
      aiLanguage: ['en', 'pl', 'ru'].includes(value.aiLanguage) ? value.aiLanguage : 'en',
      theme: value.theme === 'contrast' ? 'contrast' : 'dark',
    }
  } catch {
    return { ...defaults }
  }
}

export const usePreferencesStore = defineStore('preferences', () => {
  const preferences = ref(load())
  const error = ref('')
  const accountMode = ref(false)
  async function setAccountData(records: Preferences | null) {
    accountMode.value = true
    preferences.value = records ? { ...records, language: records.language ?? 'en' } : load()
    await nextTick()
    accountMode.value = records !== null
  }
  async function saveAccountPreferences() {
    try {
      await api('/api/account/preferences', 'PUT', preferences.value)
      error.value = ''
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Preferences could not be saved.'
    }
  }
  watch(
    preferences,
    (value) => {
      document.documentElement.dataset.theme = value.theme
      i18n.global.locale.value = value.language ?? 'en'
      document.documentElement.lang = value.language ?? 'en'
      if (accountMode.value) return
      try {
        localStorage.setItem('nexora_preferences', JSON.stringify(value))
        error.value = ''
      } catch {
        error.value = 'Preferences could not be saved. Browser storage may be full or disabled.'
      }
    },
    { deep: true },
  )
  document.documentElement.dataset.theme = preferences.value.theme
  i18n.global.locale.value = preferences.value.language ?? 'en'
  document.documentElement.lang = preferences.value.language ?? 'en'
  async function setLanguage(language: Language) {
    preferences.value.language = language
    preferences.value.locale = { en: 'en-IE', pl: 'pl-PL', ru: 'ru-RU' }[
      language
    ] as Preferences['locale']
    preferences.value.aiLanguage = language
    await nextTick()
    if (accountMode.value) await saveAccountPreferences()
  }
  function formatDate(value: string) {
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
    if (!Number.isFinite(date.getTime())) return tr('Date unavailable')
    return new Intl.DateTimeFormat(preferences.value.locale, { dateStyle: 'medium' }).format(date)
  }
  function formatCurrencyCents(cents: string | bigint, locale = preferences.value.locale) {
    const amount = BigInt(cents)
    const magnitude = amount < 0n ? -amount : amount
    const whole = magnitude / 100n
    const signed = amount < 0n ? -(whole || 1n) : whole
    const fraction = new Intl.NumberFormat(locale, {
      minimumIntegerDigits: 2,
      useGrouping: false,
    }).format(Number(magnitude % 100n))
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      currencyDisplay: preferences.value.currencyDisplay,
    })
      .formatToParts(signed)
      .map((part) => {
        if (part.type === 'fraction') return fraction
        if (part.type === 'integer' && whole === 0n) return '0'
        return part.value
      })
      .join('')
  }
  function formatCurrency(amount: number) {
    return new Intl.NumberFormat(preferences.value.locale, {
      style: 'currency',
      currency: 'EUR',
      currencyDisplay: preferences.value.currencyDisplay,
    }).format(amount)
  }
  return {
    preferences,
    error,
    setLanguage,
    formatDate,
    formatCurrencyCents,
    formatCurrency,
    accountMode,
    setAccountData,
    saveAccountPreferences,
  }
})
