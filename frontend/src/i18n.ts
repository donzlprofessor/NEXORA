import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import pl from './locales/pl.json'
import ru from './locales/ru.json'
export type Language = 'en' | 'pl' | 'ru'
export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, pl, ru },
  missingWarn: false,
  fallbackWarn: false,
})
export function t(key: string, values: Record<string, unknown> = {}): string {
  return i18n.global.t(key, values)
}
const sourceKeys: Record<string, string> = {
  'Display name is required': 'api_message_0',
  'Start must be before end': 'api_message_1',
  'Preview and explicit confirmation are required': 'api_message_2',
  'Data changed since preview. Preview again.': 'api_message_3',
  'Import has conflicts; no records were changed': 'api_message_4',
  'Unknown IANA time zone': 'api_message_5',
  'Invalid reporting period': 'api_message_6',
  'Invalid end date': 'api_message_7',
  'The model returned an unsupported answer. Please rephrase; verified figures remain available.':
    'api_message_8',
  'Model qwen3:4b is missing. Install it in local Ollama.': 'api_message_9',
  'Local inference timed out before completing a final answer. Please retry; the model may still be loading.':
    'api_message_10',
  'Ollama is offline. Start the local Ollama service.': 'api_message_11',
  'Ollama returned an invalid response. Check the local model and retry.': 'api_message_12',
  'Local AI is disabled in this deployment.': 'api_message_13',
  'Use authenticated account AI; client business totals are not authoritative.': 'api_message_14',
  'The last message must be from the user': 'api_message_15',
  'Conversation context is too long. Start a shorter conversation.': 'api_message_16',
  'Request cancelled': 'api_message_17',
  'The local model returned an invalid final response. Please retry.': 'api_message_18',
  'The local model returned internal reasoning without a final answer. Reasoning is hidden. Please retry.':
    'api_message_19',
  'The local model did not return a complete final answer. Please retry; verified figures remain available.':
    'api_message_20',
  'The local model exhausted its generation budget before completing a final answer. Its internal reasoning is hidden; your question is not necessarily too long. Please retry.':
    'api_message_21',

  'Date unavailable': 'date_unavailable',
  Dashboard: 'dashboard_2938c',
  Analytics: 'analytics_a768c',
  Customers: 'customers_e6d0e',
  Finance: 'finance_c4829',
  Settings: 'settings_f4f70',
  'AI Assistant': 'ai_assistant_35427',
  Language: 'language_4994a',
  Actions: 'actions_06df3',
  Active: 'active_4d3d7',
  Inactive: 'inactive_3cab0',
  Lead: 'lead_a745d',
  All: 'all_b1c94',
  'Active Customers': 'active_customers_de493',
  'Active Customers (Current)': 'active_customers_current_c9b7e',
  'Add Customer': 'add_customer_daaa0',
  'Add Transaction': 'add_transaction_18cef',
  'All categories': 'all_categories_62f5d',
  'All types': 'all_types_13435',
  'All-time recorded activity': 'all_time_recorded_activity_92dc3',
  'Already have an account? Sign in': 'already_have_an_account_sign_in_548a3',
  Amount: 'amount_b2f40',
  'Amount (€)': 'amount_e9e8c',
  'Amount: highest': 'amount_highest_76431',
  'Amount: lowest': 'amount_lowest_91215',
  'Are you sure you want to delete this transaction?':
    'are_you_sure_you_want_to_delete_this_transaction_627d0',
  'Ask NEXORA AI…': 'ask_nexora_ai_d06f5',
  'Authenticated account': 'authenticated_account_0b488',
  'Back to Dashboard': 'back_to_dashboard_3649f',
  'Back up and reset demo': 'back_up_and_reset_demo_0cdce',
  'Backup download failed. Export your data before importing.':
    'backup_download_failed_export_your_data_before_i_02480',
  'Backup unavailable.': 'backup_unavailable_ea76e',
  'Business Insights': 'business_insights_368af',
  'Business Summary': 'business_summary_5c156',
  Cancel: 'cancel_ea478',
  Category: 'category_3adbd',
  'Changes save automatically on this device.': 'changes_save_automatically_on_this_device_63978',
  'Chat history': 'chat_history_ee392',
  'Check connection': 'check_connection_adfd8',
  'Checking?': 'checking_4c416',
  'Choose NEXORA JSON export': 'choose_nexora_json_export_ca552',
  'Choose a JSON export smaller than 5 MB.': 'choose_a_json_export_smaller_than_5_mb_f9c58',
  'Choose a JSON file smaller than 5 MB.': 'choose_a_json_file_smaller_than_5_mb_910a8',
  'Clear chat': 'clear_chat_1b142',
  'Clear filters': 'clear_filters_0b275',
  'Close dialog': 'close_dialog_3c62b',
  'Close modal': 'close_modal_a2071',
  'Close navigation': 'close_navigation_2ce4d',
  'Collapse sidebar': 'collapse_sidebar_00873',
  Expand: 'expand_8098b',
  Company: 'company_1c76c',
  'Confirm account import': 'confirm_account_import_1bbe4',
  'Continue with local demo': 'continue_with_local_demo_e4001',
  'Create an account': 'create_an_account_2fdfd',
  'Create your account': 'create_your_account_5bef2',
  'Currency display': 'currency_display_519c6',
  Customer: 'customer_ce266',
  'Customer Lifetime Spending': 'customer_lifetime_spending_589e0',
  'Customer added.': 'customer_added_f9eff',
  'Customer could not be saved.': 'customer_could_not_be_saved_21c8d',
  'Customer deleted.': 'customer_deleted_96c31',
  'Customer updated.': 'customer_updated_4a45a',
  'Daily income from recorded transactions': 'daily_income_from_recorded_transactions_eddd9',
  Date: 'date_44749',
  'Date: newest': 'date_newest_32fdd',
  'Date: oldest': 'date_oldest_b8426',
  Delete: 'delete_f2a6c',
  'Delete failed.': 'delete_failed_c6123',
  Description: 'description_b5a7a',
  'Description or category': 'description_or_category_c22a7',
  'Display name': 'display_name_bc9e2',
  'Download last archived backup': 'download_last_archived_backup_f8257',
  'Download source backup': 'download_source_backup_d949a',
  'EUR code': 'eur_code_52128',
  'EUR symbol (€)': 'eur_symbol_de114',
  Edit: 'edit_7dce1',
  'Edit Customer': 'edit_customer_e5d63',
  'Edit Transaction': 'edit_transaction_ee6a8',
  Email: 'email_ce8ae',
  Expense: 'expense_7bf48',
  'Export JSON': 'export_json_b7b35',
  'Export and import': 'export_and_import_f3106',
  'Filter by status': 'filter_by_status_5dd5c',
  From: 'from_5da61',
  'Full Name': 'full_name_63005',
  'High contrast dark': 'high_contrast_dark_6d884',
  'How can I improve expense tracking?': 'how_can_i_improve_expense_tracking_40701',
  'Import browser records into this account': 'import_browser_records_into_this_account_f7e8c',
  'Import could not be saved.': 'import_could_not_be_saved_9e998',
  'Import failed; preview again.': 'import_failed_preview_again_bc611',
  'Import merged successfully. Existing records were preserved.':
    'import_merged_successfully_existing_records_were_cb25f',
  Income: 'income_1f08d',
  'Income Analytics': 'income_analytics_936be',
  'Invalid file.': 'invalid_file_3d919',
  'Invalid import file.': 'invalid_import_file_64104',
  'Local AI': 'local_ai_20d2c',
  'Local User': 'local_user_758aa',
  'Local demo': 'local_demo_9f0da',
  'Local demo preferences.': 'local_demo_preferences_1a6ff',
  'Local demo profile': 'local_demo_profile_dc4a4',
  'Local demo: browser records only': 'local_demo_browser_records_only_1700c',
  'Logout failed.': 'logout_failed_45363',
  'Main navigation': 'main_navigation_807ef',
  Menu: 'menu_b6154',
  'Merge import': 'merge_import_08f81',
  'NEXORA AI': 'nexora_ai_79b71',
  'NEXORA Dark': 'nexora_dark_94281',
  'Name: A to Z': 'name_a_to_z_41bdf',
  'Name: Z to A': 'name_z_to_a_9f4dc',
  'Net Profit': 'net_profit_43d72',
  'New Customers': 'new_customers_84713',
  'New customers': 'new_customers_5dc5a',
  'New customers by registration date': 'new_customers_by_registration_date_62584',
  'Nexora Workspace': 'nexora_workspace_864b3',
  Next: 'next_10ac3',
  'No customers yet. Add your first customer to get started.':
    'no_customers_yet_add_your_first_customer_to_get__77c4d',
  'No matching customers. Try another search or status.':
    'no_matching_customers_try_another_search_or_stat_f72cc',
  'No matching transactions. Try clearing filters.':
    'no_matching_transactions_try_clearing_filters_14d99',
  'No recorded expense categories in the selected period.':
    'no_recorded_expense_categories_in_the_selected_p_ef840',
  'No transactions yet. Add your first transaction!':
    'no_transactions_yet_add_your_first_transaction_346d0',
  'Number format': 'number_format_33c40',
  'Or choose a NEXORA JSON backup': 'or_choose_a_nexora_json_backup_1db9d',
  'Page not found': 'page_not_found_d0fbd',
  Password: 'password_dc647',
  Period: 'period_19016',
  'Preferences and records for your authenticated account.':
    'preferences_and_records_for_your_authenticated_a_6e43f',
  'Preview existing localStorage': 'preview_existing_localstorage_0578b',
  'Preview failed; browser records are unchanged.':
    'preview_failed_browser_records_are_unchanged_73f80',
  Previous: 'previous_dd1f7',
  'Processing account import…': 'processing_account_import_b34d6',
  'Profile and appearance': 'profile_and_appearance_65a7a',
  'Recent Transactions': 'recent_transactions_88856',
  'Recorded Income': 'recorded_income_0b607',
  'Reset aborted; storage backup could not be saved.':
    'reset_aborted_storage_backup_could_not_be_saved_fd5ee',
  'Reset demo records': 'reset_demo_records_1dfad',
  'Response language': 'response_language_48b52',
  'Revenue Overview': 'revenue_overview_0b2eb',
  'Revenue performance over time': 'revenue_performance_over_time_92b44',
  'Save Customer': 'save_customer_3f01e',
  'Save Transaction': 'save_transaction_00c11',
  'Save preferences': 'save_preferences_b089e',
  'Saving...': 'saving_575f5',
  'Connecting…': 'connecting_182e7',
  Register: 'register_0ba75',
  You: 'you_cae8d',
  Search: 'search_13348',
  'Search customers': 'search_customers_8c21c',
  'Search customers...': 'search_customers_3e377',
  'Selected calendar days including today (local time)':
    'selected_calendar_days_including_today_local_tim_65953',
  Send: 'send_94966',
  'Server-verified comparison and expenses (EUR)':
    'server_verified_comparison_and_expenses_eur_f9ed9',
  'Sign in': 'sign_in_b6d42',
  'Sign in / Register': 'sign_in_register_f3f54',
  'Sign in failed.': 'sign_in_failed_374cf',
  'Sign in to NEXORA': 'sign_in_to_nexora_954b7',
  'Sign out': 'sign_out_c87aa',
  'Skip to content': 'skip_to_content_b5827',
  Sort: 'sort_6b46a',
  'Sort customers': 'sort_customers_08cf0',
  'Spending: highest': 'spending_highest_d64ae',
  'Spending: lowest': 'spending_lowest_ff158',
  'Start date must be on or before end date.': 'start_date_must_be_on_or_before_end_date_615c7',
  Status: 'status_ec53a',
  'Status: A to Z': 'status_a_to_z_55855',
  'Status: Z to A': 'status_z_to_a_616b1',
  'Summarize the selected period.': 'summarize_the_selected_period_179f1',
  'Table pagination': 'table_pagination_16f77',
  Theme: 'theme_d7217',
  'This page does not exist in your NEXORA workspace.':
    'this_page_does_not_exist_in_your_nexora_workspac_6d432',
  Through: 'through_c0c5c',
  'Total Customers': 'total_customers_769a5',
  'Total Expenses': 'total_expenses_10f0a',
  'Total Income': 'total_income_cfb8b',
  'Total Spent': 'total_spent_c21a3',
  'Total Spent (€)': 'total_spent_e3e1d',
  'Track your business finances and performance.':
    'track_your_business_finances_and_performance_a602b',
  Transaction: 'transaction_1b0ff',
  'Transaction Type': 'transaction_type_34528',
  'Transaction added.': 'transaction_added_22da4',
  'Transaction could not be saved.': 'transaction_could_not_be_saved_282bf',
  'Transaction deleted.': 'transaction_deleted_1ce54',
  'Transaction updated.': 'transaction_updated_93a81',
  Type: 'type_a1fa2',
  'Type IMPORT ACCOUNT': 'type_import_account_cdcaf',
  'Type IMPORT to confirm': 'type_import_to_confirm_e694e',
  'Type RESET DEMO to confirm': 'type_reset_demo_to_confirm_58ade',
  'Use Save preferences to persist account settings.':
    'use_save_preferences_to_persist_account_settings_a8551',
  'Use a unique password of at least twelve characters.':
    'use_a_unique_password_of_at_least_twelve_charact_6e13b',
  'Validating file…': 'validating_file_cb91b',
  'Verified figures for the last request (EUR)': 'verified_figures_for_the_last_request_eur_939a8',
  'Verify the backup download before continuing. Your localStorage remains unchanged even after import.':
    'verify_the_backup_download_before_continuing_you_a1684',
  'What data is missing for growth analysis?': 'what_data_is_missing_for_growth_analysis_23cd6',
  'Workspace name': 'workspace_name_21f66',
  'Workspace navigation': 'workspace_navigation_8908e',
  'Your question': 'your_question_35251',
  'Financial summary': 'financial_summary_e52fe',
  Revenue: 'revenue_54358',
  Expenses: 'expenses_13495',
  'Transaction count': 'transaction_count_54c85',
  'No transactions recorded in this period.': 'no_transactions_recorded_in_this_period_51f5e',
  'Previous-period comparison unavailable.': 'previous_period_comparison_unavailable_38bb7',
  'AI explanation unavailable. Verified financial figures remain available.':
    'ai_explanation_unavailable_verified_financial_fi_343bb',
  'Request cancelled.': 'request_cancelled_99807',
  'Account and migration': 'account_and_migration_0eea0',
  'Account records live on your configured backend. Existing browser records stay in local demo storage until you explicitly import them.':
    'account_records_live_on_your_configured_backend__eb59f',
  'All records remain in EUR. Display formatting never converts or relabels monetary values.':
    'all_records_remain_in_eur_display_formatting_nev_38928',
  'All-time financial totals from saved transactions; customer status reflects current records.':
    'all_time_financial_totals_from_saved_transaction_f28b8',
  'All-time totals above. Transactions are sorted by date, newest first by default.':
    'all_time_totals_above_transactions_are_sorted_by_89c2a',
  'Analyzing local data… The first response may take longer while the model loads.':
    'analyzing_local_data_the_first_response_may_take_7acf8',
  'Ask about recorded income, expenses and customer registrations. All processing stays on this computer.':
    'ask_about_recorded_income_expenses_and_customer__3a4d9',
  'Authenticated account settings. Browser demo records stay separate.':
    'authenticated_account_settings_browser_demo_reco_f33c7',
  'Ctrl+Enter to send. Chat stays in memory for this session. Avoid typing personal information.':
    'ctrl_enter_to_send_chat_stays_in_memory_for_this_2c9d3',
  'Demo records restored. Previous raw records remain archived locally and a JSON backup was downloaded.':
    'demo_records_restored_previous_raw_records_remai_4ac65',
  'Exports contain personal customer data. Store backups privately. Imports merge new records only; conflicting IDs or emails are rejected.':
    'exports_contain_personal_customer_data_store_bac_99db0',
  'Import complete. Existing account records and all localStorage keys were preserved.':
    'import_complete_existing_account_records_and_all_a9cc0',
  'Income is based on transactions, independently of customer lifetime spending. The chart shows its selected period. Order and conversion metrics are unavailable because those events are not recorded.':
    'income_is_based_on_transactions_independently_of_a05b4',
  'Local demo preferences for this browser. Sign in to use account persistence.':
    'local_demo_preferences_for_this_browser_sign_in__10bc2',
  'Local, read-only business analysis. No customer names, emails or individual records are sent automatically.':
    'local_read_only_business_analysis_no_customer_na_a2356',
  'Manage customers. Lifetime spending is entered independently of finance transactions.':
    'manage_customers_lifetime_spending_is_entered_in_545ab',
  'Nothing is imported automatically. Preview, download a backup, then confirm. Source IDs are retained as migration references; database IDs may differ. Invalid dates and conflicts must be resolved explicitly. Repeated identical imports are skipped.':
    'nothing_is_imported_automatically_preview_downlo_0957d',
  'Ollama endpoint and model are configured in backend/.env. Only loopback Ollama endpoints are accepted. No cloud inference or business-data write access.':
    'ollama_endpoint_and_model_are_configured_in_back_f6e16',
  'This replaces the active customer and transaction lists with the original demo records. Your previous raw records are archived in this browser before replacement and exported to a JSON download. Preferences are preserved. Export first if downloads are blocked.':
    'this_replaces_the_active_customer_and_transactio_f8392',
  '{value} result(s) · Page {value} of {value}': 'value_result_s_page_value_of_value_af93f',
  'Last {value} calendar days, including today (local time). {value} to {value}.':
    'last_value_calendar_days_including_today_local_t_55cf8',
  '{value} existing customer(s) have no valid registration date and are excluded from period customer metrics.':
    'value_existing_customer_s_have_no_valid_registra_5d97e',
  'Income: {value}. Expenses: {value}. Net profit: {value}.':
    'income_value_expenses_value_net_profit_value_9c062',
  'In the selected {value} period, recorded income: {value}. Expenses: {value}. Net profit: {value}. New customers: {value}. Income uses transaction records, not customer lifetime spending. Customer counts use registration dates; historical active status is unavailable. Transactions without a valid calendar date are excluded from period metrics.':
    'in_the_selected_value_period_recorded_income_val_17a27',
  'Validated file: {value} customers and {value} transactions. Identical records will be skipped. A raw local backup is required before applying changes.':
    'validated_file_value_customers_and_value_transac_d8861',
  '{value} new customers · {value} new transactions · {value} already imported':
    'value_new_customers_value_new_transactions_value_f6c5b',
  'Snapshot at request time. Undated customers: {value}. AI explanations can be mistaken; verify against these calculated figures.':
    'snapshot_at_request_time_undated_customers_value_4b477',
  'Previous period {value} to {value}: income {value}, expenses {value}, net profit {value}.':
    'previous_period_value_to_value_income_value_expe_74ff7',
  'Income change: {value}. Time zone: {value}.': 'income_change_value_time_zone_value_f0e19',
  '{value} to {value} · Income {value} · Expenses {value} · Net profit {value} · New customers {value}':
    'value_to_value_income_value_expenses_value_net_p_294fe',
  'e.g. Website Development': 'e_g_website_development_85fb3',
  'e.g. Services': 'e_g_services_b663e',
  ready: 'ready_b2fda',
  model_missing: 'model_missing_48f4b',
  ollama_offline: 'ollama_offline_2885a',
  backend_unavailable: 'backend_unavailable_63f97',
  disabled: 'disabled_075ae',
  'Local inference timed out before completing a final answer. Please retry.':
    'local_inference_timed_out_before_completing_a_fi_0a473',
  'Local AI request failed.': 'local_ai_request_failed_48207',
  'Delete {name}?': 'delete_name_8d5ec',
  'Account: {email}': 'account_email_fcbc0',
  'Name and company are required.': 'name_and_company_are_required_87295',
  'Name and company must be at most 100 characters.':
    'name_and_company_must_be_at_most_100_characters_db638',
  'Enter a valid email address.': 'enter_a_valid_email_address_d68c7',
  'This email already belongs to another customer. Use a different email or edit that customer.':
    'this_email_already_belongs_to_another_customer_u_9708b',
  'Choose a valid customer status.': 'choose_a_valid_customer_status_9e349',
  'Lifetime spending must be a non-negative amount, at most one trillion EUR.':
    'lifetime_spending_must_be_a_non_negative_amount__b77e0',
  'Use at most two decimal places for spending.':
    'use_at_most_two_decimal_places_for_spending_f03ed',
  'Description and category are required.': 'description_and_category_are_required_4ffd2',
  'Description must be at most 200 characters and category at most 80.':
    'description_must_be_at_most_200_characters_and_c_bf899',
  'Amount must be greater than zero and at most one trillion EUR.':
    'amount_must_be_greater_than_zero_and_at_most_one_5b609',
  'Use at most two decimal places.': 'use_at_most_two_decimal_places_6f74e',
  'Choose a valid calendar date.': 'choose_a_valid_calendar_date_251f1',
  'Choose income or expense.': 'choose_income_or_expense_a807c',
  'Expected a NEXORA version 1 EUR export containing customers and transactions.':
    'expected_a_nexora_version_1_eur_export_containin_f22f9',
  'Import is limited to 50,000 total records.': 'import_is_limited_to_50_000_total_records_b978f',
  'Invalid customer record.': 'invalid_customer_record_a94c4',
  'Invalid customer registration date.': 'invalid_customer_registration_date_bb963',
  'Duplicate customer ID or email in import.': 'duplicate_customer_id_or_email_in_import_62d0d',
  'Invalid transaction record.': 'invalid_transaction_record_55b02',
  'Duplicate transaction ID in import.': 'duplicate_transaction_id_in_import_51a7a',
  'An imported email already belongs to an existing customer.':
    'an_imported_email_already_belongs_to_an_existing_b8eab',
  'Account changed while saving. Response discarded.':
    'account_changed_while_saving_response_discarded_eea6b',
  'Account changed while deleting. Response discarded.':
    'account_changed_while_deleting_response_discarde_2dafe',
  'Transaction no longer exists.': 'transaction_no_longer_exists_f3885',
  'Transactions could not be saved. Export your data before closing this tab.':
    'transactions_could_not_be_saved_export_your_data_8e84e',
  'Customers could not be saved. Export your data before closing this tab.':
    'customers_could_not_be_saved_export_your_data_be_ce2f6',
  'Backend request timed out. Please retry; browser records are unchanged.':
    'backend_request_timed_out_please_retry_browser_r_7a64f',
  'Backend unavailable. Your browser data has not been changed.':
    'backend_unavailable_your_browser_data_has_not_be_c73ed',
  'Backend request timed out. Please retry.': 'backend_request_timed_out_please_retry_7d6db',
  'The backend returned an invalid response. Please retry.':
    'the_backend_returned_an_invalid_response_please__6a184',
  'The request could not be completed.': 'the_request_could_not_be_completed_16916',
  'Live AI is disabled in the public demo. Run NEXORA locally to use Ollama.':
    'live_ai_is_disabled_in_the_public_demo_run_nexor_97a47',
  'Backend unavailable. Start the local FastAPI server and retry.':
    'backend_unavailable_start_the_local_fastapi_serv_b334a',
  'The local backend returned an invalid response. Please retry.':
    'the_local_backend_returned_an_invalid_response_p_6e830',
  'Local AI request failed. Check the backend and retry.':
    'local_ai_request_failed_check_the_backend_and_re_fb1da',
  'The model returned an empty answer.': 'the_model_returned_an_empty_answer_5bc81',
  'The model did not return a safe final answer. Internal reasoning is hidden.':
    'the_model_did_not_return_a_safe_final_answer_int_8fee1',
  'Live AI is disabled in the public demo.': 'live_ai_is_disabled_in_the_public_demo_6e0ed',
  'Preferences could not be saved.': 'preferences_could_not_be_saved_8b4f0',
  'Preferences could not be saved. Browser storage may be full or disabled.':
    'preferences_could_not_be_saved_browser_storage_m_e1be6',
  'Session restoration failed.': 'session_restoration_failed_d518d',
  'Account access is disabled in the static public demo. Run the full stack locally.':
    'account_access_is_disabled_in_the_static_public__e530c',
  'Your session expired. Sign in again; browser records are preserved.':
    'your_session_expired_sign_in_again_browser_recor_bbd4f',
  'Invalid email or password': 'invalid_email_or_password_2abaf',
  'Your session has expired. Sign in again.': 'your_session_has_expired_sign_in_again_b22b5',
  'This account could not be registered. Use another email or sign in.':
    'this_account_could_not_be_registered_use_another_268a1',
  'Too many authentication attempts. Retry in a minute.':
    'too_many_authentication_attempts_retry_in_a_minu_7fc4b',
  'Invalid CSRF token': 'invalid_csrf_token_d6f26',
  'Record not found': 'record_not_found_9df37',
  'The account database could not complete this request. Browser records remain unchanged.':
    'the_account_database_could_not_complete_this_req_a2beb',
  'A record conflicts with existing data or is still linked to a transaction.':
    'a_record_conflicts_with_existing_data_or_is_stil_deac3',
  Suggestions: 'suggestions_41ecc',
  'Local demo calculations': 'local_demo_calculations_e5e3d',
  'Invalid input. Check the highlighted fields.':
    'invalid_input_check_the_highlighted_fields_8aa62',
  'Workspace / Dashboard': 'workspace_dashboard_59c46',
  'Workspace / Analytics': 'workspace_analytics_7d869',
  'Workspace / Customers': 'workspace_customers_97625',
  'Workspace / Finance': 'workspace_finance_9bfa3',
  'Workspace / Settings': 'workspace_settings_3011a',
  'Workspace / AI Assistant': 'workspace_ai_assistant_477a5',
  '+ Add Customer': 'add_customer_0435e',
  '+ Add Transaction': 'add_transaction_5939e',
}
// API identifiers and stored business text remain unchanged. Translate only known UI messages.
export function tr(source: string): string {
  const conflicts: [RegExp, string, string[]][] = [
    [/^Duplicate (customer|transaction) source ID (.+)$/, 'migration_conflict_0', ['kind', 'id']],
    [/^Duplicate customer email for source ID (.+)$/, 'migration_conflict_1', ['id']],
    [
      /^Changed registration date for customer source ID (.+); existing history preserved$/,
      'migration_conflict_2',
      ['id'],
    ],
    [
      /^Changed (customer|transaction) source ID (.+); existing account record preserved$/,
      'migration_conflict_3',
      ['kind', 'id'],
    ],
    [/^Email conflict for customer source ID (.+)$/, 'migration_conflict_4', ['id']],
    [
      /^Transaction source ID (.+): legacy relationships need explicit account mapping$/,
      'migration_conflict_5',
      ['id'],
    ],
  ]
  for (const [pattern, key, names] of conflicts) {
    const match = source.match(pattern)
    if (match)
      return t(
        key,
        Object.fromEntries(
          names.map((name, index) => [
            name,
            name === 'kind'
              ? tr(match[index + 1] === 'customer' ? 'Customer' : 'Transaction')
              : match[index + 1],
          ]),
        ),
      )
  }

  if (source.startsWith('Invalid customer: '))
    return tr('Invalid customer record.') + ' ' + tr(source.slice(18))
  if (/^(Customer|Transaction) ID .* conflicts\./.test(source))
    return tr('A record conflicts with existing data or is still linked to a transaction.')

  if (source === 'income') source = 'Income'
  if (source === 'expense') source = 'Expense'
  return sourceKeys[source] ? t(sourceKeys[source]!) : source
}
