"""Deterministic financial replies; the model never reproduces authoritative money."""
import re
from decimal import Decimal


def asks_exact_figures(question):
    return bool(re.search(r"exact|figures|amounts|dokład|doklad|kwot|точн|сумм", question, re.I))


def contradicts_snapshot(answer):
    # Conservative fallback: untrusted prose must not deny available totals or
    # introduce business operations that the transaction ledger cannot establish.
    return bool(re.search(
        r"unavailab|not available|no access|cannot|can't|unable|no (?:financial|revenue|expense|profit) data|"
        r"brak|niemoż|nie mog|nie moż|nie ma|nie potraf|nie da się|niedostępn|"
        r"невозмож|недоступ|не могу|не можем|не может|нельзя|нет данн|отсутств|"
        r"acqui[rs]|deliver|product|recurring|fixed costs|"
        r"pozysk|dostaw|produkt|koszt\w* stał|"
        r"привлеч|достав|продукт|постоянн\w* расход",
        answer, re.I,
    ))


def financial_answer(context, language, metrics=None):
    selected = context["selected"]
    labels = {
        "en": ("Reporting period", "Revenue", "Expenses", "Net profit", "No transactions recorded in this period. Totals are zero, not missing."),
        "pl": ("Okres raportowania", "Przychody", "Wydatki", "Zysk netto", "Brak transakcji w wybranym okresie. Sumy wynoszą zero, a nie są niedostępne."),
        "ru": ("Отчётный период", "Доходы", "Расходы", "Чистая прибыль", "В этом периоде нет транзакций. Итоги равны нулю, а не отсутствуют."),
    }[language]

    def money(field, cent_field):
        amount = Decimal(metrics[cent_field]) / 100 if metrics else Decimal(str(selected[field]))
        formatted = f"{amount:.2f}"
        return formatted.replace(".", ",") + " €" if language != "en" else "€" + formatted

    lines = [
        f"{labels[0]}: {selected['start']} — {selected['end']} (EUR)",
        f"{labels[1]}: {money('totalIncome', 'revenueCents')}",
        f"{labels[2]}: {money('totalExpenses', 'expenseCents')}",
        f"{labels[3]}: {money('netProfit', 'netProfitCents')}",
    ]
    count = metrics["transactionCount"] if metrics else selected.get("transactionCount")
    if count == 0:
        lines.append(labels[4])
    return "\n".join(lines)
