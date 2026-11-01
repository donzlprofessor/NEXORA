<script setup lang="ts">
import { t } from '@/i18n'
</script>
<template>
  <section class="panel py-16 text-center">
    <p class="text-sm text-purple-300">404</p>
    <h1 class="mt-4 text-4xl font-bold">{{ t('page_not_found_d0fbd') }}</h1>
    <p class="mt-4 text-gray-400">
      {{ t('this_page_does_not_exist_in_your_nexora_workspac_6d432') }}
    </p>
    <RouterLink to="/" class="button-primary mt-6 inline-block">{{
      t('back_to_dashboard_3649f')
    }}</RouterLink>
  </section>
</template>
