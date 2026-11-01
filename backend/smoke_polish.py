"""Opt-in Polish Ollama check using synthetic data, never account records."""
import asyncio
import json
import httpx
from fastapi import HTTPException
import main


async def run():
    async with httpx.AsyncClient(trust_env=False, timeout=5) as client:
        try:
            status = await main.model_status(client)
        except httpx.HTTPError:
            print('SKIPPED: local Ollama unavailable')
            return 0
    if status['status'] != 'ready':
        print('SKIPPED: qwen3:4b not installed')
        return 0
    body = main.ChatRequest(
        messages=[main.Message(role='user', content='Przeanalizuj finanse mojej firmy i zaproponuj trzy sposoby poprawy rentowności.')],
        language='pl',
        context=main.BusinessContext(
            currency='EUR', allTime=main.Totals(totalIncome=600, totalExpenses=70, netProfit=530),
            selected=main.PeriodContext(period='30D', start='2026-10-03', end='2026-11-01', totalIncome=600, totalExpenses=70, netProfit=530, newCustomers=0, transactionCount=2),
            totalCustomers=0, activeCustomers=0, undatedCustomers=0,
        ),
    )
    try:
        async with asyncio.timeout(main.TIMEOUT):
            answer = await main.generate(body)
        print(json.dumps({'status': 'passed', 'language': 'pl', 'answer': answer}, ensure_ascii=True))
        return 0
    except (HTTPException, TimeoutError) as error:
        print(json.dumps({'status': 'failed', 'code': 'timeout' if isinstance(error, TimeoutError) else 'generation_failure', 'detail': str(error)}, ensure_ascii=True))
        return 1


if __name__ == '__main__':
    raise SystemExit(asyncio.run(run()))
