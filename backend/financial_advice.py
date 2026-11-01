"""Evidence-based suggestions; no model arithmetic or unsupported forecasts."""
def recommendations(snapshot, language):
    messages = {
        "en": {
            "empty": "Record revenue and expenses for this period before evaluating profitability.",
            "loss": "Check the recorded expense entries: expenses exceed revenue in this period.",
            "category": "Review invoices in the largest recorded expense category before deciding where to reduce costs.",
            "compare": "Record a comparable previous period before drawing conclusions about growth.",
            "reconcile": "Reconcile the recorded transactions with invoices and bank statements to check completeness.",
            "dates": "Check the dates and categories of recorded entries before comparing periods.",
        },
        "pl": {
            "empty": "Zarejestruj przychody i wydatki z tego okresu przed oceną rentowności.",
            "loss": "Sprawdź zarejestrowane wydatki: w tym okresie przewyższają przychody.",
            "category": "Sprawdź faktury w największej zarejestrowanej kategorii wydatków przed podjęciem decyzji o ograniczeniu kosztów.",
            "compare": "Uzupełnij dane za porównywalny poprzedni okres przed wyciąganiem wniosków o wzroście.",
            "reconcile": "Uzgodnij zarejestrowane transakcje z fakturami i wyciągami bankowymi, aby sprawdzić kompletność danych.",
            "dates": "Sprawdź daty i kategorie zarejestrowanych transakcji przed porównaniem okresów.",
        },
        "ru": {
            "empty": "Внесите доходы и расходы за этот период, прежде чем оценивать рентабельность.",
            "loss": "Проверьте учтённые расходы: в этом периоде они превышают доходы.",
            "category": "Проверьте счета в крупнейшей учтённой категории расходов, прежде чем сокращать затраты.",
            "compare": "Внесите данные за сопоставимый предыдущий период, прежде чем делать выводы о росте.",
            "reconcile": "Сверьте учтённые транзакции со счетами и банковскими выписками, чтобы проверить полноту данных.",
            "dates": "Проверьте даты и категории учтённых транзакций перед сравнением периодов.",
        },
    }[language]
    keys = []
    if not snapshot["availability"]["selectedPeriod"]: return [messages["empty"]]
    if int(snapshot["metrics"]["netProfitCents"]) < 0: keys.append("loss")
    if snapshot["availability"]["expenseCategories"]: keys.append("category")
    if not snapshot["availability"]["previousPeriod"]: keys.append("compare")
    keys.extend(["reconcile", "dates"])
    return [messages[key] for key in keys[:3]]
