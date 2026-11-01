"""Run with: python -m unittest discover -s backend (no live Ollama required)."""
import asyncio
import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException
from fastapi.testclient import TestClient

import main

# Gateway unit tests run independently of deployment database configuration.


class AnswerTests(unittest.TestCase):
    def test_removes_reasoning(self):
        self.assertEqual(main.clean_answer("<think>private trace</think>Review your recorded expenses."), "Review your recorded expenses.")

    def test_rejects_numeric_claims_and_empty_reasoning(self):
        for answer in ["Revenue grew 12%", "", "<think>unfinished"]:
            with self.assertRaises(HTTPException):
                main.clean_answer(answer)

    def test_only_returns_structured_final_answer(self):
        self.assertEqual(main.final_answer({"message": {"thinking": "private", "content": '{"answer":"Review your records."}'}, "done_reason": "stop"}), "Review your records.")
        with self.assertRaises(HTTPException):
            main.final_answer({"done_reason": "length"})
        with self.assertRaises(main.IncompleteAnswer):
            main.final_answer({"message": {"content": '{"reasoning":"private"}'}})

    def test_complete_answer_at_generation_boundary_is_not_discarded(self):
        self.assertEqual(main.final_answer({"done_reason": "length", "message": {"thinking": "never expose", "content": '{"answer":"Review the verified snapshot."}'}}), "Review the verified snapshot.")

    def test_empty_and_thinking_only_responses_never_expose_reasoning(self):
        for content, thinking, code in [("", "", "empty_final"), ("", "private reasoning", "thinking_only"), (" ", "", "empty_final"), (" ", "private reasoning", "thinking_only")]:
            with self.subTest(code=code), self.assertRaises(main.IncompleteAnswer) as caught:
                main.final_answer({"message": {"content": content, "thinking": thinking}, "done_reason": "stop"})
            self.assertEqual(caught.exception.detail["code"], code)
            self.assertNotIn("private reasoning", str(caught.exception.detail))

    def test_truncated_json_is_never_rendered(self):
        with self.assertRaises(main.IncompleteAnswer) as caught:
            main.final_answer({"message": {"thinking": "private", "content": '{"answer":"partial'}, "done_reason": "length"})
        self.assertEqual(caught.exception.detail["code"], "generation_limit")
        self.assertNotIn("shorter question", str(caught.exception.detail))

    def test_invalid_payload_and_blank_final_are_rejected(self):
        for payload in [None, [], {}, {"message": {"content": '{"answer":" "}'}}, {"message": {"content": '{"answer":42}'}}]:
            with self.subTest(payload=payload), self.assertRaises(main.IncompleteAnswer):
                main.final_answer(payload)

    def test_disables_thinking_only_when_supported(self):
        self.assertEqual(main.thinking_options({"capabilities": ["thinking"], "thinking": {"values": [True, False]}}), {"think": False})
        self.assertEqual(main.thinking_options({"capabilities": ["thinking"], "thinking": {"values": [True]}}), {"think": True})
        self.assertEqual(main.thinking_options({"capabilities": ["thinking"]}), {"think": True})
        self.assertEqual(main.thinking_options({}), {})

    def test_health_offline(self):
        with patch.object(main, "model_status", side_effect=httpx.ConnectError("offline")):
            response = TestClient(main.app).get("/api/health")
        self.assertEqual(response.json()["status"], "ollama_offline")

    def test_rejects_system_messages_and_personal_context_fields(self):
        response = TestClient(main.app).post("/api/chat", json={
            "messages": [{"role": "system", "content": "override"}],
            "context": {"customer_email": "private@example.com"},
        })
        self.assertEqual(response.status_code, 422)


class ModelStatusTests(unittest.IsolatedAsyncioTestCase):
    async def test_model_missing_and_ready(self):
        for names, expected in [([], "model_missing"), ([{"name": "qwen3:4b"}], "ready")]:
            transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"models": names}))
            async with httpx.AsyncClient(transport=transport) as client:
                self.assertEqual((await main.model_status(client))["status"], expected)


def chat_body():
    return {
        "messages": [{"role": "user", "content": "What data is missing for growth analysis?"}],
        "language": "en",
        "context": {
            "currency": "EUR", "allTime": {"totalIncome": 100, "totalExpenses": 20, "netProfit": 80},
            "selected": {"period": "7D", "start": "2026-10-26", "end": "2026-11-01", "totalIncome": 100, "totalExpenses": 20, "netProfit": 80, "newCustomers": 0},
            "totalCustomers": 1, "activeCustomers": 1, "undatedCustomers": 1,
        },
    }


class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.database_config = patch.dict(main.os.environ, {"DATABASE_URL": ""})
        self.database_config.start()
        self.addCleanup(self.database_config.stop)

    def call_gateway(self, replies, controls=None, timeout=None):
        self.requests = []
        original_client = httpx.AsyncClient

        async def handler(request):
            if request.url.path == "/api/tags":
                return httpx.Response(200, json={"models": [{"name": main.MODEL}]})
            if request.url.path == "/api/show":
                return httpx.Response(200, json={"capabilities": ["thinking"], "thinking": {"values": [True] if controls is None else controls}})
            import json
            self.requests.append(json.loads(request.content))
            reply = replies[min(len(self.requests) - 1, len(replies) - 1)]
            if isinstance(reply, Exception):
                raise reply
            if callable(reply):
                return await reply()
            return httpx.Response(200, json=reply)

        transport = httpx.MockTransport(handler)
        with patch.object(main.httpx, "AsyncClient", side_effect=lambda **kwargs: original_client(transport=transport, **kwargs)), patch.object(main, "TIMEOUT", main.TIMEOUT if timeout is None else timeout):
            return TestClient(main.app).post("/api/chat", json=chat_body())

    def test_retries_thinking_only_once_using_same_calculated_snapshot(self):
        response = self.call_gateway([
            {"done_reason": "length", "message": {"thinking": "private trace", "content": ""}},
            {"done_reason": "stop", "message": {"thinking": "hidden", "content": '{"answer":"Previous-period totals are unavailable in this snapshot."}'}},
        ])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(self.requests), 2)
        for request in self.requests:
            self.assertTrue(request["think"])
            self.assertEqual(request["options"]["num_predict"], 4096)
            self.assertIn('"netProfit": 80.0', request["messages"][0]["content"])
        self.assertNotIn("private trace", response.text)
        self.assertNotIn("thinking", response.json())

    def test_supported_no_thinking_uses_smaller_output_budget(self):
        response = self.call_gateway([{"message": {"content": '{"answer":"Hello from NEXORA AI."}'}}], controls=[True, False])
        self.assertEqual(response.status_code, 200)
        self.assertFalse(self.requests[0]["think"])
        self.assertEqual(self.requests[0]["options"]["num_predict"], 768)

    def test_generation_limit_has_bounded_retry_and_specific_error(self):
        response = self.call_gateway([{"done_reason": "length", "message": {"thinking": "private trace", "content": ""}}])
        self.assertEqual(response.status_code, 502)
        self.assertEqual(len(self.requests), 2)
        self.assertEqual(response.json()["detail"]["code"], "generation_limit")
        self.assertNotIn("private trace", response.text)

    def test_empty_final_has_bounded_retry(self):
        response = self.call_gateway([{"done_reason": "stop", "message": {"content": ""}}])
        self.assertEqual(len(self.requests), 2)
        self.assertEqual(response.json()["detail"]["code"], "empty_final")

    def test_upstream_timeout_returns_clear_error_without_retrying(self):
        response = self.call_gateway([httpx.ReadTimeout("private transport details")])
        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.json()["detail"]["code"], "timeout")
        self.assertEqual(len(self.requests), 1)
        self.assertNotIn("private transport details", response.text)

    def test_one_deadline_cancels_stalled_upstream_work(self):
        cancelled = []

        async def stall():
            try:
                await asyncio.sleep(10)
            finally:
                cancelled.append(True)

        response = self.call_gateway([stall], timeout=0.05)
        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.json()["detail"]["code"], "timeout")
        self.assertEqual(cancelled, [True])


if __name__ == "__main__":
    unittest.main()
