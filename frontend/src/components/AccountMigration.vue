<script setup lang="ts">
import { t, tr } from '@/i18n'
import { ref } from 'vue'
import { api } from '@/services/http'
import { useAuthStore } from '@/stores/auth'
import { downloadJson, validateBundle, type DataBundle } from '@/utils/dataTransfer'
const auth = useAuthStore()
interface Preview {
  conflicts: string[]
  newCustomers: number
  newTransactions: number
  skipped: number
  previewToken: string
}
const preview = ref<Preview | null>(null),
  source = ref<DataBundle | null>(null)
const confirmation = ref(''),
  error = ref(''),
  feedback = ref(''),
  busy = ref(false),
  backedUp = ref(false)
async function stage(bundle: unknown) {
  preview.value = null
  confirmation.value = ''
  backedUp.value = false
  error.value = ''
  feedback.value = ''
  source.value = validateBundle(bundle)
  preview.value = await api<Preview>('/api/account/import/preview', 'POST', source.value)
}
async function previewLocal() {
  busy.value = true
  try {
    await stage({
      version: 1,
      currency: 'EUR',
      customers: JSON.parse(localStorage.getItem('nexora_customers') ?? '[]'),
      transactions: JSON.parse(localStorage.getItem('nexora-transactions') ?? '[]'),
    })
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Preview failed; browser records are unchanged.'
  } finally {
    busy.value = false
  }
}
async function previewFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  busy.value = true
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Choose a JSON file smaller than 5 MB.')
    await stage(JSON.parse(await file.text()))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Invalid import file.'
  } finally {
    input.value = ''
    busy.value = false
  }
}
function backup() {
  try {
    downloadJson(source.value, 'nexora-before-account-import.json')
    backedUp.value = true
  } catch {
    error.value = 'Backup download failed. Export your data before importing.'
  }
}
async function migrate() {
  if (
    !source.value ||
    !preview.value ||
    preview.value.conflicts.length ||
    !backedUp.value ||
    confirmation.value !== 'IMPORT ACCOUNT'
  )
    return
  busy.value = true
  error.value = ''
  try {
    await api('/api/account/import', 'POST', {
      ...source.value,
      confirm: true,
      previewToken: preview.value.previewToken,
    })
    await auth.loadData()
    preview.value = null
    source.value = null
    confirmation.value = ''
    feedback.value =
      'Import complete. Existing account records and all localStorage keys were preserved.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Import failed; preview again.'
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section class="panel space-y-4">
    <h2 class="text-xl font-semibold">{{ t('import_browser_records_into_this_account_f7e8c') }}</h2>
    <p class="text-sm text-gray-400">
      {{ t('nothing_is_imported_automatically_preview_downlo_0957d') }}
    </p>
    <button class="button-primary" :disabled="busy" @click="previewLocal">
      {{ t('preview_existing_localstorage_0578b') }}
    </button>
    <label class="block"
      >{{ t('or_choose_a_nexora_json_backup_1db9d')
      }}<input
        type="file"
        accept=".json,application/json"
        :disabled="busy"
        class="field mt-2 block max-w-full"
        @change="previewFile"
    /></label>
    <p v-if="busy" role="status">{{ t('processing_account_import_b34d6') }}</p>
    <p v-if="error" role="alert" class="text-red-300">{{ tr(error) }}</p>
    <p v-if="feedback" role="status" class="text-green-300">{{ tr(feedback) }}</p>
    <div v-if="preview" class="space-y-3 rounded-xl border border-purple-500/30 p-4">
      <p>
        {{
          t('value_new_customers_value_new_transactions_value_f6c5b', {
            p0: preview.newCustomers,
            p1: preview.newTransactions,
            p2: preview.skipped,
          })
        }}
      </p>
      <ul v-if="preview.conflicts.length" class="list-inside list-disc text-red-300">
        <li v-for="conflict in preview.conflicts" :key="conflict">{{ tr(conflict) }}</li>
      </ul>
      <button class="button-secondary" @click="backup">
        {{ t('download_source_backup_d949a') }}
      </button>
      <p class="text-xs text-gray-400">
        {{ t('verify_the_backup_download_before_continuing_you_a1684') }}
      </p>
      <label class="block"
        >{{ t('type_import_account_cdcaf')
        }}<input v-model="confirmation" autocomplete="off" class="field mt-2 w-full"
      /></label>
      <button
        class="button-primary"
        :disabled="
          busy || !backedUp || preview.conflicts.length > 0 || confirmation !== 'IMPORT ACCOUNT'
        "
        @click="migrate"
      >
        {{ t('confirm_account_import_1bbe4') }}
      </button>
      <button class="button-secondary ml-3" @click="preview = null">{{ t('cancel_ea478') }}</button>
    </div>
  </section>
</template>
