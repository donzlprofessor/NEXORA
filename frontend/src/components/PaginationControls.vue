<script setup lang="ts">
import { t } from '@/i18n'
defineProps<{ page: number; pages: number; total: number }>()
defineEmits<{ change: [page: number] }>()
</script>
<template>
  <nav
    :aria-label="t('table_pagination_16f77')"
    class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-5 text-sm text-gray-400"
  >
    <p>{{ t('value_result_s_page_value_of_value_af93f', { p0: total, p1: page, p2: pages }) }}</p>
    <div class="flex gap-2">
      <button class="button-secondary" :disabled="page <= 1" @click="$emit('change', page - 1)">
        {{ t('previous_dd1f7') }}</button
      ><button
        class="button-secondary"
        :disabled="page >= pages"
        @click="$emit('change', page + 1)"
      >
        {{ t('next_10ac3') }}
      </button>
    </div>
  </nav>
</template>
