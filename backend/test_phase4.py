"""Financial and multilingual regressions on isolated databases and mocked Ollama."""
import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException
import test_accounts
import main


class Phase4Tests(unittest.TestCase):
    setUp = test_accounts.AccountsTests.setUp
    tearDown = test_accounts.AccountsTests.tearDown
    session = test_accounts.AccountsTests.session
    signup = test_accounts.AccountsTests.signup
    write = test_accounts.AccountsTests.write

    def add(self, amount, kind, day):
        response = self.write('POST', '/api/account/transactions', {
            'description': 'Fixture', 'category': 'Services', 'amount': amount,
            'type': kind, 'date': day,
        })
        self.assertEqual(response.status_code, 201, response.text)

    def snapshot(self, end='2026-11-01'):
        response = self.client.get('/api/account/snapshot', params={'period': '7D', 'end': end})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_exact_cents_boundaries_counts_previous_and_categories(self):
        self.signup()
        self.add('600.10', 'income', '2026-10-26')
        self.add('0.20', 'income', '2026-11-01')
        self.add('70.01', 'expense', '2026-11-01')
        self.add('9.99', 'income', '2026-10-25')
        self.add('999.00', 'income', '2026-11-02')
        snapshot = self.snapshot()
        self.assertEqual(snapshot['metrics'], {
            'revenueCents': '60030', 'expenseCents': '7001', 'netProfitCents': '53029',
            'transactionCount': 3, 'incomeCount': 2, 'expenseCount': 1,
        })
        self.assertEqual(snapshot['previousMetrics']['revenueCents'], '999')
        self.assertTrue(snapshot['availability']['previousPeriod'])
        self.assertEqual(snapshot['expenseCategories'][0]['amountCents'], '7001')
        self.assertEqual(snapshot['context']['selected']['start'], '2026-10-26')

    def test_empty_period_and_negative_profit_are_explicit(self):
        self.signup()
        empty = self.snapshot()
        self.assertEqual(empty['metrics']['netProfitCents'], '0')
        self.assertFalse(empty['availability']['selectedPeriod'])
        self.assertFalse(empty['availability']['previousPeriod'])
        self.add('70.01', 'expense', '2026-11-01')
        self.assertEqual(self.snapshot()['metrics']['netProfitCents'], '-7001')

    def test_metrics_survive_offline_timeout_and_generation_failure(self):
        self.signup()
        self.add('600', 'income', '2026-11-01')
        self.add('70', 'expense', '2026-11-01')
        for status in [502, 503, 504]:
            with self.subTest(status=status), patch.object(main, 'generate', AsyncMock(side_effect=HTTPException(status, {'code': 'timeout', 'message': 'private failure'}))):
                response = self.write('POST', '/api/account/chat', {
                    'messages': [{'role': 'user', 'content': 'Podsumuj finanse.'}],
                    'language': 'pl', 'period': '7D', 'end': '2026-11-01',
                })
            self.assertEqual(response.status_code, 200, response.text)
            result = response.json()
            self.assertEqual(result['snapshot']['metrics']['netProfitCents'], '53000')
            self.assertIsNone(result['explanation'])
            self.assertEqual(result['content'], '')
            self.assertEqual(len(result['recommendations']), 3)
            self.assertNotIn('private failure', response.text)

    def test_model_prose_cannot_replace_metrics(self):
        self.signup()
        self.add('0.10', 'income', '2026-11-01')
        with patch.object(main, 'generate', AsyncMock(return_value='Review the verified summary.')):
            response = self.write('POST', '/api/account/chat', {
                'messages': [{'role': 'user', 'content': 'Summary'}], 'end': '2026-11-01',
            })
        self.assertEqual(response.json()['snapshot']['metrics']['revenueCents'], '10')
        self.assertEqual(response.json()['explanation'], 'Review the verified summary.')

    def test_invalid_language_period_date_and_zone_rejected(self):
        self.signup()
        for extra in [{'language': 'de'}, {'period': 'ALL'}, {'end': '2026-02-30'}, {'end': '0001-01-01'}, {'zone': 'Unknown/Zone'}]:
            response = self.write('POST', '/api/account/chat', {
                'messages': [{'role': 'user', 'content': 'Summary'}], **extra,
            })
            self.assertEqual(response.status_code, 422, response.text)

    def test_polish_account_preference_round_trip(self):
        self.signup()
        preferences = self.client.get('/api/account/preferences').json()
        preferences.update(language='pl', aiLanguage='pl', locale='pl-PL')
        self.assertEqual(self.write('PUT', '/api/account/preferences', preferences).status_code, 200)
        self.assertEqual(self.client.get('/api/account/preferences').json(), preferences)

    def test_exact_figures_bypass_ollama_in_all_languages(self):
        self.signup()
        self.add('600.00', 'income', '2026-11-01')
        self.add('70.00', 'expense', '2026-11-01')
        self.add('999.00', 'income', '2026-10-01')
        for language, question, expected in [
            ('pl', 'Podaj dokładne przychody, wydatki i zysk netto.', 'Zysk netto: 530,00 €'),
            ('en', 'Show exact revenue, expenses and net profit.', 'Net profit: €530.00'),
            ('ru', 'Покажи точные доходы, расходы и чистую прибыль.', 'Чистая прибыль: 530,00 €'),
        ]:
            with self.subTest(language=language), patch.object(main, 'generate', AsyncMock(side_effect=HTTPException(503, 'offline'))) as model:
                result = self.write('POST', '/api/account/chat', {
                    'messages': [{'role': 'user', 'content': question}],
                    'language': language, 'period': '7D', 'end': '2026-11-01',
                })
            self.assertEqual(result.status_code, 200, result.text)
            self.assertIn(expected, result.json()['content'])
            self.assertIn('600', result.json()['content'])
            self.assertIn('70', result.json()['content'])
            self.assertNotIn('999', result.json()['content'])
            self.assertIn('2026-10-26', result.json()['content'])
            self.assertEqual(result.json()['snapshot']['metrics']['netProfitCents'], '53000')
            model.assert_not_called()
        # The deterministic route is still protected by session CSRF validation.
        self.assertEqual(self.client.post('/api/account/chat', json={
            'messages': [{'role': 'user', 'content': 'Exact figures'}],
        }).status_code, 403)

    def test_misleading_model_denials_and_unsupported_assumptions_are_replaced(self):
        self.signup()
        self.add('600.00', 'income', '2026-11-01')
        self.add('70.00', 'expense', '2026-11-01')
        for language, denial, expected in [
            ('pl', 'Dane są dostępne dla wybranego okresu. Brak możliwości podania dokładnych kwot.', 'Zysk netto: 530,00 €'),
            ('en', 'Exact financial amounts are unavailable.', 'Net profit: €530.00'),
            ('ru', 'Точные суммы недоступны.', 'Чистая прибыль: 530,00 €'),
            ('en', 'Improve delivery times and acquire more customers.', 'Net profit: €530.00'),
        ]:
            with self.subTest(language=language, denial=denial), patch.object(main, 'generate', AsyncMock(return_value=denial)):
                result = self.write('POST', '/api/account/chat', {
                    'messages': [{'role': 'user', 'content': 'Summary'}],
                    'language': language, 'end': '2026-11-01',
                })
            self.assertEqual(result.status_code, 200, result.text)
            self.assertIn(expected, result.json()['content'])
            self.assertNotIn(denial, result.json()['content'])

    def test_empty_exact_reply_is_zero_not_missing_in_all_languages(self):
        self.signup()
        for language, zero_text in [('pl', 'zero'), ('en', 'zero'), ('ru', 'нулю')]:
            result = self.write('POST', '/api/account/chat', {
                'messages': [{'role': 'user', 'content': 'Exact figures'}],
                'language': language, 'end': '2026-11-01',
            })
            self.assertEqual(result.status_code, 200)
            self.assertIn(zero_text, result.json()['content'])
            self.assertEqual(result.json()['snapshot']['metrics']['transactionCount'], 0)
            self.assertEqual(len(result.json()['recommendations']), 1)
        # Zero-valued entries are records, not an empty/missing period.
        self.add('0.00', 'income', '2026-11-01')
        result = self.write('POST', '/api/account/chat', {
            'messages': [{'role': 'user', 'content': 'Exact figures'}], 'end': '2026-11-01',
        }).json()
        self.assertEqual(result['snapshot']['metrics']['transactionCount'], 1)
        self.assertNotIn('No transactions', result['content'])

    def test_local_demo_exact_reply_uses_selected_context_without_ollama(self):
        from test_main import chat_body
        for language, expected in [('en', '€80.00'), ('pl', '80,00 €'), ('ru', '80,00 €')]:
            body = {**chat_body(), 'language': language, 'messages': [{'role': 'user', 'content': 'Exact figures'}]}
            with patch.dict(main.os.environ, {'DATABASE_URL': ''}), patch.object(main, 'generate', AsyncMock()) as model:
                response = self.client.post('/api/chat', json=body)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertIn(expected, response.json()['content'])
            model.assert_not_called()


class LocalizedGenerationTests(unittest.IsolatedAsyncioTestCase):
    async def test_language_instructions_and_final_only_for_each_supported_language(self):
        original = httpx.AsyncClient
        for language, label, answer in [
            ('en', 'English', 'Review recorded expenses.'),
            ('pl', 'professional Polish', 'Przeanalizuj zarejestrowane wydatki.'),
            ('ru', 'natural Russian', 'Проверьте учтённые расходы.'),
        ]:
            captured = []
            def handler(request):
                if request.url.path == '/api/tags':
                    return httpx.Response(200, json={'models': [{'name': main.MODEL}]})
                if request.url.path == '/api/show':
                    return httpx.Response(200, json={})
                captured.append(json.loads(request.content))
                return httpx.Response(200, json={'message': {'thinking': 'PRIVATE', 'content': json.dumps({'answer': answer})}})
            from test_main import chat_body
            body = main.ChatRequest(**{**chat_body(), 'language': language})
            with patch.object(main.httpx, 'AsyncClient', side_effect=lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs)):
                result = await main.generate(body)
            self.assertEqual(result, answer)
            self.assertNotIn('PRIVATE', result)
            self.assertIn(label, captured[0]['messages'][0]['content'])
