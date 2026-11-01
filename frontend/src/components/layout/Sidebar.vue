<script setup lang="ts">
import { t, tr } from '@/i18n'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { usePreferencesStore } from '@/stores/preferences'
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
const router = useRouter()
async function logout() {
  try {
    await auth.logout()
    await router.push('/login')
  } catch (cause) {
    auth.error = cause instanceof Error ? cause.message : 'Logout failed.'
  }
}
import { useDialog } from '@/composables/useDialog'
defineOptions({ name: 'WorkspaceSidebar' })

const route = useRoute()
const settings = usePreferencesStore()
const open = ref(false)
const compact = ref(false)
const menu = [
  { path: '/', name: 'Dashboard', icon: '◈' },
  { path: '/analytics', name: 'Analytics', icon: '▥' },
  { path: '/customers', name: 'Customers', icon: '♙' },
  { path: '/finance', name: 'Finance', icon: '◎' },
  { path: '/assistant', name: 'AI Assistant', icon: '✦' },
  { path: '/settings', name: 'Settings', icon: '⚙' },
]
const initials = computed(
  () =>
    settings.preferences.name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U',
)
watch(
  () => route.path,
  () => {
    open.value = false
  },
)
useDialog(open, () => {
  open.value = false
})
</script>

<template>
  <button
    class="fixed left-4 top-3 z-40 rounded-xl border border-white/15 bg-[#12121f] px-4 py-2 text-sm lg:hidden"
    aria-controls="workspace-navigation"
    :aria-expanded="open"
    @click="open = !open"
  >
    {{ t('menu_b6154') }}
  </button>
  <div v-if="open" class="fixed inset-0 z-40 bg-black/70 lg:hidden" @click="open = false" />
  <aside
    id="workspace-navigation"
    :role="open ? 'dialog' : undefined"
    :aria-modal="open ? true : undefined"
    :aria-label="t('workspace_navigation_8908e')"
    :class="[open ? 'flex' : 'hidden lg:flex', compact ? 'lg:w-24' : 'lg:w-64']"
    class="fixed inset-y-0 left-0 z-50 w-64 shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-[#0d0d18] p-4 lg:sticky lg:top-0 lg:h-screen"
  >
    <div class="mb-8 flex items-center justify-between gap-2 px-2">
      <RouterLink
        to="/"
        class="text-xl font-black tracking-wider text-purple-300"
        :aria-label="compact ? 'NEXORA — ' + tr('Dashboard') : undefined"
        >{{ compact ? 'N' : 'NEXORA' }}</RouterLink
      >
      <button
        class="text-gray-400 lg:hidden"
        :aria-label="t('close_navigation_2ce4d')"
        @click="open = false"
      >
        ×
      </button>
    </div>
    <div v-if="!compact" class="mb-6 rounded-xl border border-white/10 bg-white/5 p-3">
      <p class="break-words text-sm font-semibold">
        {{ settings.preferences.workspace || t('nexora_workspace_864b3') }}
      </p>
      <p class="mt-1 text-xs text-gray-500">{{ t('local_demo_9f0da') }}</p>
    </div>
    <nav class="flex flex-col gap-2" :aria-label="t('main_navigation_807ef')">
      <RouterLink
        v-for="item in menu"
        :key="item.path"
        :to="item.path"
        :aria-current="route.path === item.path ? 'page' : undefined"
        :title="tr(item.name)"
        :class="
          route.path === item.path
            ? 'bg-purple-600/20 text-purple-300'
            : 'text-gray-400 hover:bg-white/5 hover:text-white'
        "
        class="flex items-center gap-3 rounded-xl px-3 py-3 transition"
      >
        <span aria-hidden="true" class="w-6 shrink-0 text-center text-xs font-bold">{{
          item.icon
        }}</span
        ><span :class="compact ? 'lg:sr-only' : ''" class="text-sm font-medium">{{
          tr(item.name)
        }}</span>
      </RouterLink>
    </nav>
    <button v-if="auth.user" class="button-secondary my-4" @click="logout">
      {{ t('sign_out_c87aa') }}
    </button>
    <div class="mt-auto border-t border-white/10 pt-5">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-600 font-bold"
        >
          {{ initials }}
        </div>
        <div v-if="!compact" class="min-w-0">
          <p class="truncate text-sm font-semibold">
            {{ settings.preferences.name || t('local_user_758aa') }}
          </p>
          <p class="text-xs text-gray-500">
            {{ auth.user ? t('authenticated_account_0b488') : t('local_demo_profile_dc4a4') }}
          </p>
        </div>
      </div>
      <button
        class="mt-5 hidden w-full rounded-lg border border-white/10 px-2 py-2 text-xs text-gray-400 lg:block"
        :aria-expanded="!compact"
        @click="compact = !compact"
      >
        {{ compact ? t('expand_8098b') : t('collapse_sidebar_00873') }}
      </button>
    </div>
  </aside>
</template>
