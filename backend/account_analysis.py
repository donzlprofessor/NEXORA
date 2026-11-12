"""Account-only period resolution and deterministic English analysis composition."""
import re
import unicodedata
from decimal import Decimal


def reporting_period(question, selected):
    days = set(re.findall(r"\b(?:last|past)\s+(7|30|90)(?:\s+|-)days?\b", question, re.I))
    return f"{days.pop()}D" if len(days) == 1 else selected


def valid_english_explanation(answer):
    # English prose may use Latin names/accents, punctuation and currency symbols,
    # but must not introduce another script or restate a reporting window.
    if any(char.isalpha() and "LATIN" not in unicodedata.name(char, "") for char in answer):
        return False
    return not re.search(
        r"\b(?:days?|weeks?|months?|years?|zero|one|two|three|four|five|six|seven|eight|nine|ten|"
        r"eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|"
        r"thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|percent|euros?|eur)\b",
        answer, re.I,
    )


def english_analysis(snapshot, advice, *, explanation=None, fallback=False):
    from financial_answer import financial_answer
    selected = snapshot["context"]["selected"]
    metrics = snapshot["metrics"]
    lines = [financial_answer(snapshot["context"], "en", metrics)]
    lines.append(f"Window: {selected['period'][:-1]} calendar days ({snapshot['timezone']}).")
    if fallback:
        lines.append("AI explanation unavailable or invalid. This summary uses verified account records.")
    if metrics["transactionCount"]:
        profit = int(metrics["netProfitCents"])
        lines.append("Recorded revenue exceeds expenses; net profit is positive." if profit > 0 else
                     "Recorded expenses exceed revenue; the period shows a net loss." if profit < 0 else
                     "Recorded revenue equals expenses; net profit is zero.")
        if snapshot["availability"]["previousPeriod"]:
            change = int(metrics["revenueCents"]) - int(snapshot["previousMetrics"]["revenueCents"])
            amount = f"€{Decimal(abs(change)) / 100:.2f}"
            lines.append(f"Recorded revenue is {'higher' if change > 0 else 'lower'} than in the preceding equal-length period by {amount}."
                         if change else "Recorded revenue matches the preceding equal-length period.")
        else:
            lines.append("There are no recorded transactions in the preceding equal-length period; growth cannot be assessed from these records.")
    if explanation:
        lines.extend(["", explanation])
    if advice:
        lines.extend(["", "Suggested improvements:"])
        lines.extend(f"{index}. {item}" for index, item in enumerate(advice, 1))
    return "\n".join(lines)
