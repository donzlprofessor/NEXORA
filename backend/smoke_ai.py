r"""Opt-in live Ollama smoke check: .\.venv\Scripts\python.exe smoke_ai.py.

Uses a synthetic, consistent snapshot fixture; never reads browser/localStorage data.
Only final answers and token/length diagnostics are printed, never internal reasoning.
"""
import json
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

import main

PROMPTS = ["Hello", "Summarize my business", "What data is missing for growth analysis?", "How can I improve expense tracking?"]
CONTEXT = {
    "currency": "EUR",
    "allTime": {"totalIncome": 100, "totalExpenses": 20, "netProfit": 80},
    "selected": {"period": "7D", "start": "2026-10-26", "end": "2026-11-01", "totalIncome": 100, "totalExpenses": 20, "netProfit": 80, "newCustomers": 0},
    "totalCustomers": 1, "activeCustomers": 1, "undatedCustomers": 1,
}


def run():
    original_client = httpx.AsyncClient
    diagnostics = []

    async def observe(response):
        if response.request.url.path != "/api/chat":
            return
        await response.aread()
        payload = response.json()
        message = payload.get("message", {})
        diagnostics.append({"done_reason": payload.get("done_reason"), "generated_tokens": payload.get("eval_count"), "thinking_characters": len(message.get("thinking", "")), "final_characters": len(message.get("content", ""))})

    def client(**kwargs):
        return original_client(**kwargs, event_hooks={"response": [observe]})

    failed = False
    with patch.object(main.httpx, "AsyncClient", side_effect=client), TestClient(main.app) as app:
        for prompt in PROMPTS:
            diagnostics.clear()
            response = app.post("/api/chat", json={"messages": [{"role": "user", "content": prompt}], "context": CONTEXT, "language": "en"})
            payload = response.json()
            failed |= response.status_code != 200
            print(json.dumps({"prompt": prompt, "status": response.status_code, "response": payload, "attempts": diagnostics}, ensure_ascii=True), flush=True)
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(run())
