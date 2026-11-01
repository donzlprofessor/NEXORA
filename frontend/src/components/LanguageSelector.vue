<script setup lang="ts">
import { usePreferencesStore } from '@/stores/preferences'
import { t, type Language } from '@/i18n'
const settings = usePreferencesStore()
</script>
<template>
  <label class="flex items-center gap-2 text-sm">
    <span>{{ t('language') }}</span>
    <select
      class="field"
      :value="settings.preferences.language ?? 'en'"
      @change="settings.setLanguage(($event.target as HTMLSelectElement).value as Language)"
    >
      <option value="en">🇬🇧 English</option>
      <option value="pl">🇵🇱 Polski</option>
      <option value="ru">🇷🇺 Русский</option>
    </select>
  </label>
</template>
