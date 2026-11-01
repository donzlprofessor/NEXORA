<script setup lang="ts">
import { t, tr } from '@/i18n'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const registering = computed(() => route.name === 'register')
const email = ref(''),
  password = ref(''),
  name = ref(''),
  error = ref('')
async function submit() {
  error.value = ''
  try {
    await auth.authenticate(registering.value ? 'register' : 'login', {
      email: email.value,
      password: password.value,
      ...(registering.value ? { name: name.value } : {}),
    })
    password.value = ''
    await router.push('/')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Sign in failed.'
  }
}
</script>
<template>
  <section class="panel mx-auto max-w-lg space-y-5">
    <h1 class="text-3xl font-bold">
      {{ registering ? t('create_your_account_5bef2') : t('sign_in_to_nexora_954b7') }}
    </h1>
    <p class="text-sm text-gray-400">
      {{ t('account_records_live_on_your_configured_backend__eb59f') }}
    </p>
    <form class="space-y-4" @submit.prevent="submit">
      <label v-if="registering" class="block"
        >{{ t('display_name_bc9e2')
        }}<input
          v-model="name"
          required
          maxlength="80"
          autocomplete="name"
          class="field mt-2 w-full"
      /></label>
      <label class="block"
        >{{ t('email_ce8ae')
        }}<input
          v-model="email"
          type="email"
          required
          maxlength="254"
          autocomplete="email"
          class="field mt-2 w-full"
      /></label>
      <label class="block"
        >{{ t('password_dc647')
        }}<input
          v-model="password"
          type="password"
          required
          minlength="12"
          maxlength="128"
          :autocomplete="registering ? 'new-password' : 'current-password'"
          class="field mt-2 w-full"
      /></label>
      <p class="text-xs text-gray-400">
        {{ t('use_a_unique_password_of_at_least_twelve_charact_6e13b') }}
      </p>
      <p v-if="error" role="alert" class="text-red-300">{{ tr(error) }}</p>
      <button class="button-primary w-full" :disabled="auth.loading">
        {{
          auth.loading
            ? t('connecting_182e7')
            : registering
              ? t('register_0ba75')
              : t('sign_in_b6d42')
        }}
      </button>
    </form>
    <RouterLink :to="registering ? '/login' : '/register'" class="block text-purple-300">{{
      registering ? t('already_have_an_account_sign_in_548a3') : t('create_an_account_2fdfd')
    }}</RouterLink>
    <RouterLink to="/" class="block text-sm text-gray-400">{{
      t('continue_with_local_demo_e4001')
    }}</RouterLink>
  </section>
</template>
