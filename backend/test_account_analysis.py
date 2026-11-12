"""Full authenticated flow with in-memory data and a mocked Ollama HTTP provider."""
import json
import unittest
from datetime import date
from unittest.mock import patch

import httpx

import main
from database import TransactionRecord, User
import test_phase4

PROMPT = "Analyze my business performance over the last 90 days. Summarize revenue, expenses, net profit, and suggest three practical improvements."
OBSERVED = "Positive net profit in last 7 days. Suggestions: 优化 expense categories. Check transaction completeness. Address previous period inactivity."


class AccountAnalysisTests(unittest.TestCase):
    session = test_phase4.Phase4Tests.session
    signup = test_phase4.Phase4Tests.signup
    write = test_phase4.Phase4Tests.write
    add = test_phase4.Phase4Tests.add

    def setUp(self):
        # Always SQLite, regardless of any developer/CI PostgreSQL configuration.
        self.environment = patch.dict(main.os.environ, {"NEXORA_TEST_POSTGRES_URL": "", "AI_MODE": "local"})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        test_phase4.Phase4Tests.setUp(self)
        self.signup()
        self.add('100.00', 'income', '2026-11-01')
        self.add('20.00', 'expense', '2026-11-01')
        self.add('200.00', 'income', '2026-10-12')
        self.add('300.00', 'income', '2026-09-02')
        self.add('999.00', 'income', '2026-08-02')
        with self.session() as db, db.begin():
            user = User(email='other@example.com', name='Other', password_hash='test-only')
            db.add(user)
            db.flush()
            db.add(TransactionRecord(owner_id=user.id, description='Private', category='Private',
                                     amount_cents=99999999, type='income', date=date(2026, 11, 1)))

    def tearDown(self):
        test_phase4.Phase4Tests.tearDown(self)

    def ask(self, output='Review recorded expense invoices.', *, days=90, failure=None, malformed=False):
        self.provider_requests = []
        original = httpx.AsyncClient

        def handler(request):
            if request.url.path == '/api/tags':
                if failure == 'offline':
                    raise httpx.ConnectError('PRIVATE connection details')
                return httpx.Response(200, json={'models': [{'name': main.MODEL}]})
            if request.url.path == '/api/show':
                return httpx.Response(200, json={})
            self.provider_requests.append(json.loads(request.content))
            if failure == 'timeout':
                raise httpx.ReadTimeout('PRIVATE timeout details')
            content = '{invalid json' if malformed else json.dumps({'answer': output})
            return httpx.Response(200, json={'message': {'thinking': 'PRIVATE reasoning', 'content': content}})

        with patch.object(main.httpx, 'AsyncClient', side_effect=lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs)):
            result = self.write('POST', '/api/account/chat', {
                'messages': [
                    {'role': 'user', 'content': 'Summarize the last 7 days.'},
                    {'role': 'assistant', 'content': 'Earlier answer for seven days.'},
                    {'role': 'user', 'content': PROMPT.replace('90 days', f'{days} days')},
                ],
                # Deliberately stale selector: backend must independently honor latest prompt.
                'period': '7D' if days != 7 else '30D', 'language': 'en',
                'end': '2026-11-01', 'zone': 'Europe/Warsaw',
            })
        self.assertEqual(result.status_code, 200, result.text)
        self.assertNotIn('PRIVATE', result.text)
        return result.json()

    def assert_summary(self, result, days=90, revenue='600.00', profit='580.00'):
        self.assertEqual(result['snapshot']['context']['selected']['period'], f'{days}D')
        self.assertIn(f'Window: {days} calendar days (Europe/Warsaw)', result['content'])
        self.assertIn(f'Revenue: €{revenue}', result['content'])
        self.assertIn('Expenses: €20.00', result['content'])
        self.assertIn(f'Net profit: €{profit}', result['content'])
        self.assertNotIn(OBSERVED, result['content'])
        self.assertNotRegex(result['content'], r'[\u3400-\u9fff]')
        self.assertEqual(len(result['recommendations']), 3)
        for index, advice in enumerate(result['recommendations'], 1):
            self.assertIn(f'{index}. {advice}', result['content'])
        self.assertNotIn('999999', result['content'])

    def test_explicit_windows_override_stale_selector_and_history_through_provider(self):
        for days, revenue, profit in [(7, '100.00', '80.00'), (30, '300.00', '280.00'), (90, '600.00', '580.00')]:
            with self.subTest(days=days):
                result = self.ask(days=days)
                self.assert_summary(result, days, revenue, profit)
                self.assertEqual(result['aiStatus'], 'ready')
                self.assertIn('Recorded revenue exceeds expenses', result['content'])
                self.assertIn('Review recorded expense invoices.', result['content'])
                system = self.provider_requests[0]['messages'][0]['content']
                self.assertIn(f'"period": "{days}D"', system)
                self.assertIn('English', system)
                self.assertIn(main.ACCOUNT_ENGLISH_EXPLANATION, system)
                self.assertNotIn('999999', system)

    def test_observed_response_and_other_invalid_outputs_use_verified_fallback(self):
        for output, malformed in [
            (OBSERVED, False),
            ('Positive net profit. Suggestions: 优化 expense categories.', False),
            ('Positive net profit in the last seven days.', False),
            ('Revenue is €999999.00.', False),
            ('Revenue is six hundred euros.', False),
            ('Investigate customer acquisition channels.', False),
            ('', False), ('ignored', True),
        ]:
            with self.subTest(output=output):
                result = self.ask(output, malformed=malformed)
                self.assert_summary(result)
                self.assertNotEqual(result['aiStatus'], 'ready')
                self.assertIsNone(result['explanation'])
                self.assertIn('AI explanation unavailable or invalid', result['content'])
                self.assertNotIn('last seven days', result['content'])
                self.assertNotIn('last 7 days', result['content'])

    def test_offline_and_timeout_have_complete_english_fallbacks(self):
        for failure in ('offline', 'timeout'):
            with self.subTest(failure=failure):
                result = self.ask(failure=failure)
                self.assert_summary(result)
                self.assertIn('verified account records', result['content'])
                self.assertIsNone(result['explanation'])

    def test_english_fallback_reports_loss_and_empty_data_without_fabrication(self):
        from account_analysis import english_analysis
        from accounts import snapshot
        from financial_advice import recommendations
        with self.session() as db, db.begin():
            owner_id = db.query(User.id).filter(User.email == 'alice@example.com').scalar()
            db.add(TransactionRecord(owner_id=owner_id, description='Loss fixture', category='Office',
                                     amount_cents=100000, type='expense', date=date(2026, 11, 1)))
        with self.session() as db:
            metrics = snapshot(db, owner_id, '90D', date(2026, 11, 1), 'Europe/Warsaw')
            reply = english_analysis(metrics, recommendations(metrics, 'en'), fallback=True)
            self.assertIn('Net profit: €-420.00', reply)
            self.assertIn('net loss', reply)
            empty = snapshot(db, owner_id, '90D', date(2020, 11, 1), 'Europe/Warsaw')
            reply = english_analysis(empty, recommendations(empty, 'en'), fallback=True)
            self.assertIn('No transactions recorded', reply)
            self.assertNotIn('net profit is positive', reply)


if __name__ == '__main__':
    unittest.main()
