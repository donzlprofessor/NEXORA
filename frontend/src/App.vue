<script setup lang="ts">
import { isPublicDemo } from '@/demo/config'
const publicDemo = isPublicDemo()
import { t, tr } from '@/i18n'
import LanguageSelector from '@/components/LanguageSelector.vue'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
import Sidebar from './components/layout/Sidebar.vue'
import { RouterView } from 'vue-router'
import { useFinanceStore } from '@/stores/finance'
import { useCustomersStore } from '@/stores/customers'
const finance = useFinanceStore()
const customers = useCustomersStore()
const storageError = computed(() =>
  [finance.storageError, customers.storageError].filter(Boolean).join(' '),
)
</script>

<template>
  <div class="flex min-h-screen bg-[#080812] text-white">
    <a
      href="#main-content"
      class="sr-only z-50 rounded bg-purple-700 p-3 focus:not-sr-only focus:fixed"
      >{{ t('skip_to_content_b5827') }}</a
    >
    <Sidebar />
    <main
      id="main-content"
      tabindex="-1"
      class="min-w-0 flex-1 px-4 pb-8 pt-20 sm:px-6 lg:p-8 xl:p-10"
    >
      <p
        v-if="storageError"
        role="alert"
        class="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200"
      >
        {{ tr(storageError) }}
      </p>
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-400">
        <p>
          {{
            auth.user
              ? t('account_email_fcbc0', { email: auth.user.email })
              : t('local_demo_browser_records_only_1700c')
          }}
        </p>
        <RouterLink v-if="!publicDemo && !auth.user" to="/login" class="text-purple-300">{{
          t('sign_in_register_f3f54')
        }}</RouterLink>
        <RouterLink v-else-if="auth.user" to="/account" class="text-purple-300">{{
          t('account_and_migration_0eea0')
        }}</RouterLink>
      </div>
      <p v-if="auth.error" role="alert" class="mb-4 text-amber-300">{{ tr(auth.error) }}</p>
      <p
        v-if="publicDemo"
        role="status"
        class="mb-5 rounded-xl border border-purple-400/30 bg-purple-500/10 p-4 text-sm text-purple-200"
      >
        <strong>{{ t('public_demo_label') }}</strong> {{ t('public_demo_storage') }}
      </p>
      <LanguageSelector class="mb-5" />
      <RouterView />
    </main>
  </div>
</template>
