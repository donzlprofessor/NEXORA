<script setup lang="ts">
import { portfolioData } from '@/demo/data'
import { isPublicDemo } from '@/demo/config'
const publicDemo = isPublicDemo()
import { t, tr } from '@/i18n'
import LanguageSelector from '@/components/LanguageSelector.vue'
import { useAuthStore } from '@/stores/auth'
import AccountMigration from '@/components/AccountMigration.vue'
const auth = useAuthStore()
import { computed, onMounted, ref } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import { useCustomersStore, demoCustomers } from '@/stores/customers'
import { useFinanceStore, defaultTransactions } from '@/stores/finance'
import { useAssistantStore } from '@/stores/assistant'
import {
  downloadJson,
  mergeBundle,
  persistBundle,
  validateBundle,
  type DataBundle,
} from '@/utils/dataTransfer'

const settings = usePreferencesStore()
const customers = useCustomersStore()
const finance = useFinanceStore()
const assistant = useAssistantStore()
const error = ref('')
const feedback = ref('')
const staged = ref<DataBundle | null>(null)
const confirmation = ref('')
const resetText = ref('')
const backupKey = ref('')
const busy = ref(false)
const current = (): DataBundle => ({
  version: 1,
  currency: 'EUR',
  customers: customers.customers,
  transactions: finance.transactions,
})
const added = computed(() =>
  staged.value
    ? { customers: staged.value.customers.length, transactions: staged.value.transactions.length }
    : null,
)

async function stage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  staged.value = null
  error.value = ''
  confirmation.value = ''
  feedback.value = ''
  if (!file) return
  busy.value = true
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Choose a JSON export smaller than 5 MB.')
    const validated = validateBundle(JSON.parse(await file.text()))
    mergeBundle(current(), validated) // Detect conflicts before showing a confirmation.
    staged.value = validated
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Invalid file.'
  } finally {
    input.value = ''
    busy.value = false
  }
}

function apply(bundle: DataBundle) {
  if (customers.accountMode)
    throw new Error('Local reset/import is unavailable in account mode. Use account import.')
  backupKey.value = persistBundle(bundle)
  customers.customers = bundle.customers.map((c) => ({ ...c }))
  finance.transactions = bundle.transactions.map((t) => ({ ...t }))
  assistant.clear()
}
function importData() {
  if (confirmation.value !== 'IMPORT' || !staged.value) return
  try {
    // Recheck against current records; importing never overwrites existing identifiers.
    apply(mergeBundle(current(), staged.value))
    staged.value = null
    confirmation.value = ''
    error.value = ''
    feedback.value = 'Import merged successfully. Existing records were preserved.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Import could not be saved.'
  }
}
function resetDemo() {
  if (resetText.value !== 'RESET DEMO') return
  try {
    downloadJson(current(), 'nexora-before-reset.json')
    apply({
      version: 1,
      currency: 'EUR',
      customers: publicDemo ? portfolioData().customers : demoCustomers.map((c) => ({ ...c })),
      transactions: publicDemo
        ? portfolioData().transactions
        : defaultTransactions.map((t) => ({ ...t })),
    })
    resetText.value = ''
    error.value = ''
    feedback.value =
      'Demo records restored. Previous raw records remain archived locally and a JSON backup was downloaded.'
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Reset aborted; storage backup could not be saved.'
  }
}
function downloadBackup() {
  try {
    const raw = JSON.parse(localStorage.getItem(backupKey.value) ?? 'null')
    if (!raw) throw new Error('Backup unavailable.')
    downloadJson(
      {
        version: 1,
        currency: 'EUR',
        customers: JSON.parse(raw.customers ?? '[]'),
        transactions: JSON.parse(raw.transactions ?? '[]'),
      },
      'nexora-archived-backup.json',
    )
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Backup unavailable.'
  }
}
onMounted(() => void assistant.checkConnection())
</script>

<template>
  <div class="space-y-6">
    <header>
      <p class="mb-2 text-sm text-gray-500">{{ t('workspace_settings_3011a') }}</p>
      <h1 class="text-4xl font-bold">{{ t('settings_f4f70') }}</h1>
      <p class="mt-3 text-gray-400">
        {{
          publicDemo
            ? t('public_demo_storage')
            : auth.user
              ? t('preferences_and_records_for_your_authenticated_a_6e43f')
              : t('local_demo_preferences_for_this_browser_sign_in__10bc2')
        }}
      </p>
    </header>
    <p v-if="error || settings.error" role="alert" class="text-red-300">
      {{ tr(error || settings.error) }}
    </p>
    <p v-if="feedback" role="status" class="text-green-300">{{ tr(feedback) }}</p>
    <p class="text-sm text-gray-400">
      {{
        auth.user
          ? t('authenticated_account_settings_browser_demo_reco_f33c7')
          : t('local_demo_preferences_1a6ff')
      }}
    </p>
    <button
      v-if="settings.accountMode"
      class="button-primary"
      @click="settings.saveAccountPreferences"
    >
      {{ t('save_preferences_b089e') }}
    </button>
    <AccountMigration v-if="auth.user" />
    <section class="panel space-y-4">
      <LanguageSelector />
      <h2 class="text-xl font-semibold">{{ t('profile_and_appearance_65a7a') }}</h2>
      <p class="text-sm text-gray-400">
        {{
          settings.accountMode
            ? t('use_save_preferences_to_persist_account_settings_a8551')
            : t('changes_save_automatically_on_this_device_63978')
        }}
      </p>
      <div class="grid gap-4 md:grid-cols-2">
        <label
          >{{ t('display_name_bc9e2')
          }}<input v-model="settings.preferences.name" maxlength="80" class="field w-full"
        /></label>
        <label
          >{{ t('workspace_name_21f66')
          }}<input v-model="settings.preferences.workspace" maxlength="80" class="field w-full"
        /></label>
        <label
          >{{ t('number_format_33c40')
          }}<select v-model="settings.preferences.locale" class="field w-full">
            <option value="en-IE">English (Ireland)</option>
            <option value="de-DE">Deutsch</option>
            <option value="pl-PL">Polski</option>
            <option value="ru-RU">Русский</option>
          </select></label
        >
        <label
          >{{ t('currency_display_519c6')
          }}<select v-model="settings.preferences.currencyDisplay" class="field w-full">
            <option value="symbol">{{ t('eur_symbol_de114') }}</option>
            <option value="code">{{ t('eur_code_52128') }}</option>
          </select></label
        >
        <label
          >{{ t('theme_d7217')
          }}<select v-model="settings.preferences.theme" class="field w-full">
            <option value="dark">{{ t('nexora_dark_94281') }}</option>
            <option value="contrast">{{ t('high_contrast_dark_6d884') }}</option>
          </select></label
        >
      </div>
      <p class="text-sm text-gray-400">
        {{ t('all_records_remain_in_eur_display_formatting_nev_38928') }}
      </p>
    </section>
    <section class="panel space-y-4">
      <h2 class="text-xl font-semibold">{{ t('local_ai_20d2c') }}</h2>
      <p role="status">{{ tr(assistant.connection.status) }} · {{ assistant.connection.model }}</p>
      <label
        >{{ t('response_language_48b52')
        }}<select v-model="assistant.language" class="field ml-3">
          <option value="en">English</option>
          <option value="pl">Polski</option>
          <option value="ru">Русский</option>
        </select></label
      >
      <button
        class="button-secondary ml-3"
        :disabled="assistant.checking"
        @click="assistant.checkConnection"
      >
        {{ assistant.checking ? t('checking_4c416') : t('check_connection_adfd8') }}
      </button>
      <p class="text-sm text-gray-400">
        {{ t('ollama_endpoint_and_model_are_configured_in_back_f6e16') }}
      </p>
    </section>
    <section class="panel space-y-4">
      <h2 class="text-xl font-semibold">{{ t('export_and_import_f3106') }}</h2>
      <p class="text-sm text-gray-400">
        {{ t('exports_contain_personal_customer_data_store_bac_99db0') }}
      </p>
      <button class="button-primary" @click="downloadJson(current(), 'nexora-export.json')">
        {{ t('export_json_b7b35') }}
      </button>
      <label class="block"
        >{{ t('choose_nexora_json_export_ca552')
        }}<input
          class="field mt-2 block max-w-full"
          type="file"
          v-if="!customers.accountMode"
          accept=".json,application/json"
          :disabled="busy"
          @change="stage"
      /></label>
      <p v-if="busy" role="status">{{ t('validating_file_cb91b') }}</p>
      <div v-if="staged && added" class="rounded-xl border border-purple-500/40 p-4">
        <p>
          {{
            t('validated_file_value_customers_and_value_transac_d8861', {
              p0: added.customers,
              p1: added.transactions,
            })
          }}
        </p>
        <label class="mt-3 block"
          >{{ t('type_import_to_confirm_e694e')
          }}<input v-model="confirmation" autocomplete="off" class="field ml-3"
        /></label>
        <button
          class="button-primary mt-3"
          :disabled="confirmation !== 'IMPORT'"
          @click="importData"
        >
          {{ t('merge_import_08f81') }}
        </button>
        <button class="button-secondary ml-3" @click="staged = null">
          {{ t('cancel_ea478') }}
        </button>
      </div>
      <button v-if="backupKey" class="button-secondary" @click="downloadBackup">
        {{ t('download_last_archived_backup_f8257') }}
      </button>
    </section>
    <section v-if="!customers.accountMode" class="panel space-y-4 border-red-500/30">
      <h2 class="text-xl font-semibold text-red-300">{{ t('reset_demo_records_1dfad') }}</h2>
      <p class="text-sm text-gray-400">
        {{ t('this_replaces_the_active_customer_and_transactio_f8392') }}
      </p>
      <label class="block"
        >{{ t('type_reset_demo_to_confirm_58ade')
        }}<input v-model="resetText" autocomplete="off" class="field ml-3"
      /></label>
      <button
        class="button-secondary text-red-300"
        :disabled="resetText !== 'RESET DEMO' || assistant.pending"
        @click="resetDemo"
      >
        {{ t('back_up_and_reset_demo_0cdce') }}
      </button>
    </section>
  </div>
</template>
