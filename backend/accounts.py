"""User-scoped CRUD, opaque sessions and explicit non-destructive legacy imports."""
import hashlib
import hmac
import os
import re
import secrets
import time
from collections import defaultdict, deque
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from threading import Lock
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pwdlib import PasswordHash
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import CustomerRecord, LoginSession, PreferenceRecord, TransactionRecord, User, get_db, utcnow

router = APIRouter(prefix="/api")
passwords = PasswordHash.recommended()
DUMMY_HASH = passwords.hash(secrets.token_urlsafe(32))
COOKIE = "nexora_session"
cookie_auth = APIKeyCookie(name=COOKIE, auto_error=False)
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
ALLOWED_ORIGINS = os.getenv("APP_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173").split(",")
_attempts = defaultdict(deque)
_attempt_lock = Lock()


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


def normalized_email(value):
    value = value.strip().lower()
    if len(value) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
        raise ValueError("Enter a valid email address")
    return value


class Credentials(Input):
    email: str
    password: str = Field(min_length=12, max_length=128)
    # Password whitespace is significant, unlike display fields.
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    _email = field_validator("email")(normalized_email)


class Registration(Credentials):
    language: Literal["en", "pl", "ru"] = "en"
    name: str = Field(min_length=1, max_length=80)


class CustomerInput(Input):
    name: str = Field(min_length=1, max_length=100)
    email: str
    company: str = Field(min_length=1, max_length=100)
    status: Literal["Active", "Inactive", "Lead"]
    totalSpent: Decimal = Field(ge=0, le=10**12, decimal_places=2)
    createdAt: datetime | None = None
    _email = field_validator("email")(normalized_email)

    @field_validator("createdAt")
    @classmethod
    def aware(cls, value):
        if value is not None and value.tzinfo is None:
            # Legacy date-only registrations have no recoverable time zone.
            raise ValueError("Registration timestamps must include a time zone")
        return value


class TransactionInput(Input):
    description: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=200)
    amount: Decimal = Field(ge=0, le=10**12, decimal_places=2)
    type: Literal["income", "expense"]
    date: date
    customerId: int | None = Field(default=None, gt=0)


class PreferenceInput(Input):
    name: str = Field(default="Local User", min_length=1, max_length=80)
    workspace: str = Field(default="Nexora Workspace", min_length=1, max_length=80)
    locale: Literal["en-IE", "de-DE", "pl-PL", "ru-RU"] = "en-IE"
    currencyDisplay: Literal["symbol", "code"] = "symbol"
    theme: Literal["dark", "contrast"] = "dark"
    aiLanguage: Literal["en", "pl", "ru"] = "en"
    language: Literal["en", "pl", "ru"] = "en"


def rate_limit(request):
    key = request.client.host if request.client else "unknown"
    with _attempt_lock:
        attempts = _attempts[key]
        now = time.monotonic()
        while attempts and now - attempts[0] > 60:
            attempts.popleft()
        if len(attempts) >= 15:
            raise HTTPException(429, "Too many authentication attempts. Retry in a minute.")
        attempts.append(now)


def current_session(request: Request, token: str | None = Depends(cookie_auth), db: Session = Depends(get_db)):
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest()) if token else None
    if session is None or session.expires_at.replace(tzinfo=session.expires_at.tzinfo or timezone.utc) <= utcnow():
        raise HTTPException(401, "Your session has expired. Sign in again.")
    if request.method not in {"GET", "HEAD", "OPTIONS"} and not hmac.compare_digest(request.headers.get("X-CSRF-Token", "").encode(), session.csrf.encode()):
        raise HTTPException(403, "Invalid CSRF token")
    return session


def profile(db, session):
    user = db.get(User, session.owner_id)
    return {"id": user.id, "email": user.email, "name": user.name, "csrf": session.csrf}


def establish(db, user, response, previous=None):
    if previous:
        existing = db.get(LoginSession, hashlib.sha256(previous.encode()).hexdigest())
        if existing:
            db.delete(existing)
    token = secrets.token_urlsafe(48)
    session = LoginSession(token_hash=hashlib.sha256(token.encode()).hexdigest(), owner_id=user.id, csrf=secrets.token_urlsafe(32), expires_at=utcnow() + timedelta(hours=12))
    db.add(session); db.commit()
    response.set_cookie(COOKIE, token, httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=43200, path="/api")
    return profile(db, session)


@router.post("/auth/register", status_code=201)
def register(body: Registration, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit(request)
    user = User(email=body.email, password_hash=passwords.hash(body.password), name=body.name.strip())
    if not user.name:
        raise HTTPException(422, "Display name is required")
    db.add(user)
    try:
        db.flush()
        db.add(PreferenceRecord(owner_id=user.id, values=PreferenceInput(name=user.name, language=body.language, aiLanguage=body.language, locale={"en": "en-IE", "pl": "pl-PL", "ru": "ru-RU"}[body.language]).model_dump()))
        return establish(db, user, response, request.cookies.get(COOKIE))
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This account could not be registered. Use another email or sign in.")


@router.post("/auth/login")
def login(body: Credentials, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit(request)
    user = db.scalar(select(User).where(User.email == body.email))
    valid = passwords.verify(body.password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid:
        raise HTTPException(401, "Invalid email or password")
    return establish(db, user, response, request.cookies.get(COOKIE))


@router.get("/auth/me")
def me(session=Depends(current_session), db: Session = Depends(get_db)):
    return profile(db, session)


@router.post("/auth/logout", status_code=204)
def logout(response: Response, session=Depends(current_session), db: Session = Depends(get_db)):
    db.delete(session); db.commit()
    response.delete_cookie(COOKIE, path="/api", secure=COOKIE_SECURE, httponly=True, samesite="lax")


def customer_json(c):
    return {"id": c.id, "name": c.name, "email": c.email, "company": c.company, "status": c.status, "totalSpent": c.total_spent_cents / 100, **({"createdAt": c.created_at.replace(tzinfo=c.created_at.tzinfo or timezone.utc).isoformat()} if c.created_at else {})}


def transaction_json(t):
    return {"id": t.id, "description": t.description, "category": t.category, "amount": t.amount_cents / 100, "type": t.type, "date": t.date.isoformat(), **({"customerId": t.customer_id} if t.customer_id else {})}


def owned(db, model, owner_id, record_id):
    row = db.scalar(select(model).where(model.id == record_id, model.owner_id == owner_id))
    if row is None:
        raise HTTPException(404, "Record not found")
    return row


def commit(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A record conflicts with existing data or is still linked to a transaction.")


def apply_customer(row, body):
    for name in ["name", "email", "company", "status"]:
        setattr(row, name, getattr(body, name))
    row.total_spent_cents = int(body.totalSpent * 100)


def apply_transaction(db, owner_id, row, body):
    if body.customerId is not None:
        owned(db, CustomerRecord, owner_id, body.customerId)
    for name in ["description", "category", "type", "date"]:
        setattr(row, name, getattr(body, name))
    row.amount_cents = int(body.amount * 100)
    row.customer_id = body.customerId


@router.get("/account/customers")
def list_customers(page: int = Query(1, ge=1), size: int = Query(25, ge=1, le=100), search: str = Query("", max_length=200), status: Literal["Active", "Inactive", "Lead"] | None = None, sort: Literal["name", "status", "totalSpent"] = "name", descending: bool = False, session=Depends(current_session), db: Session = Depends(get_db)):
    query = select(CustomerRecord).where(CustomerRecord.owner_id == session.owner_id)
    if search:
        query = query.where(or_(*[column.contains(search, autoescape=True) for column in [CustomerRecord.name, CustomerRecord.email, CustomerRecord.company]]))
    if status:
        query = query.where(CustomerRecord.status == status)
    column = {"name": CustomerRecord.name, "status": CustomerRecord.status, "totalSpent": CustomerRecord.total_spent_cents}[sort]
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(column.desc() if descending else column.asc(), CustomerRecord.id).offset((page-1)*size).limit(size)).all()
    return {"items": [customer_json(c) for c in rows], "total": total, "page": page, "size": size}


@router.post("/account/customers", status_code=201)
def create_customer(body: CustomerInput, session=Depends(current_session), db: Session = Depends(get_db)):
    row = CustomerRecord(owner_id=session.owner_id, created_at=body.createdAt or utcnow())
    apply_customer(row, body); db.add(row); commit(db)
    return customer_json(row)


@router.put("/account/customers/{record_id}")
def update_customer(record_id: int, body: CustomerInput, session=Depends(current_session), db: Session = Depends(get_db)):
    row = owned(db, CustomerRecord, session.owner_id, record_id)
    apply_customer(row, body); commit(db)
    return customer_json(row)


@router.get("/account/customers/{record_id}")
def get_customer(record_id: int, session=Depends(current_session), db: Session = Depends(get_db)):
    return customer_json(owned(db, CustomerRecord, session.owner_id, record_id))


@router.delete("/account/customers/{record_id}", status_code=204)
def delete_customer(record_id: int, session=Depends(current_session), db: Session = Depends(get_db)):
    db.delete(owned(db, CustomerRecord, session.owner_id, record_id)); commit(db)


@router.get("/account/transactions")
def list_transactions(page: int = Query(1, ge=1), size: int = Query(25, ge=1, le=100), search: str = Query("", max_length=200), type: Literal["income", "expense"] | None = None, category: str | None = Query(None, max_length=200), start: date | None = None, end: date | None = None, sort: Literal["date", "amount"] = "date", descending: bool = True, session=Depends(current_session), db: Session = Depends(get_db)):
    query = select(TransactionRecord).where(TransactionRecord.owner_id == session.owner_id)
    if search:
        query = query.where(or_(TransactionRecord.description.contains(search, autoescape=True), TransactionRecord.category.contains(search, autoescape=True)))
    for condition, clause in [(type is not None, TransactionRecord.type == type), (category is not None, TransactionRecord.category == category), (start is not None, TransactionRecord.date >= (start or date.min)), (end is not None, TransactionRecord.date <= (end or date.max))]:
        if condition: query = query.where(clause)
    if start and end and start > end: raise HTTPException(422, "Start must be before end")
    column = TransactionRecord.date if sort == "date" else TransactionRecord.amount_cents
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(column.desc() if descending else column.asc(), TransactionRecord.id).offset((page-1)*size).limit(size)).all()
    return {"items": [transaction_json(t) for t in rows], "total": total, "page": page, "size": size}


@router.post("/account/transactions", status_code=201)
def create_transaction(body: TransactionInput, session=Depends(current_session), db: Session = Depends(get_db)):
    row = TransactionRecord(owner_id=session.owner_id)
    apply_transaction(db, session.owner_id, row, body); db.add(row); commit(db)
    return transaction_json(row)


@router.put("/account/transactions/{record_id}")
def update_transaction(record_id: int, body: TransactionInput, session=Depends(current_session), db: Session = Depends(get_db)):
    row = owned(db, TransactionRecord, session.owner_id, record_id)
    apply_transaction(db, session.owner_id, row, body); commit(db)
    return transaction_json(row)


@router.get("/account/transactions/{record_id}")
def get_transaction(record_id: int, session=Depends(current_session), db: Session = Depends(get_db)):
    return transaction_json(owned(db, TransactionRecord, session.owner_id, record_id))


@router.delete("/account/transactions/{record_id}", status_code=204)
def delete_transaction(record_id: int, session=Depends(current_session), db: Session = Depends(get_db)):
    db.delete(owned(db, TransactionRecord, session.owner_id, record_id)); commit(db)


@router.get("/account/preferences")
def preferences(session=Depends(current_session), db: Session = Depends(get_db)):
    row = db.get(PreferenceRecord, session.owner_id)
    return row.values if row else PreferenceInput().model_dump()


@router.put("/account/preferences")
def save_preferences(body: PreferenceInput, session=Depends(current_session), db: Session = Depends(get_db)):
    row = db.get(PreferenceRecord, session.owner_id)
    if row is None: row = PreferenceRecord(owner_id=session.owner_id); db.add(row)
    row.values = body.model_dump(); commit(db)
    return row.values


@router.get("/account/data")
def account_data(session=Depends(current_session), db: Session = Depends(get_db)):
    return {"version": 1, "currency": "EUR", "customers": [customer_json(c) for c in db.scalars(select(CustomerRecord).where(CustomerRecord.owner_id == session.owner_id).order_by(CustomerRecord.id))], "transactions": [transaction_json(t) for t in db.scalars(select(TransactionRecord).where(TransactionRecord.owner_id == session.owner_id).order_by(TransactionRecord.id))]}


class LegacyCustomer(CustomerInput):
    id: int = Field(ge=0, le=9007199254740991)


class LegacyTransaction(TransactionInput):
    id: int = Field(ge=0, le=9007199254740991)


class ImportBody(Input):
    version: Literal[1]
    currency: Literal["EUR"]
    customers: list[LegacyCustomer] = Field(max_length=10000)
    transactions: list[LegacyTransaction] = Field(max_length=10000)
    confirm: bool = False
    previewToken: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")


def import_plan(body, db, owner_id):
    conflicts, additions = [], []
    seen_ids, seen_emails = set(), set()
    for kind, items, model, serializer in [("customer", body.customers, CustomerRecord, customer_json), ("transaction", body.transactions, TransactionRecord, transaction_json)]:
        for item in items:
            key = (kind, str(item.id))
            if key in seen_ids: conflicts.append(f"Duplicate {kind} source ID {item.id}"); continue
            seen_ids.add(key)
            if kind == "customer":
                if item.email in seen_emails: conflicts.append(f"Duplicate customer email for source ID {item.id}"); continue
                seen_emails.add(item.email)
            row = db.scalar(select(model).where(model.owner_id == owner_id, model.legacy_id == str(item.id)))
            if row:
                data = serializer(row); data.pop("id")
                incoming = item.model_dump(mode="json", exclude={"id"})
                if kind == "customer":
                    row_time = row.created_at.replace(tzinfo=row.created_at.tzinfo or timezone.utc) if row.created_at else None
                    if row_time != item.createdAt:
                        conflicts.append(f"Changed registration date for customer source ID {item.id}; existing history preserved")
                        continue
                    incoming.pop("createdAt"); data.pop("createdAt", None)
                else:
                    incoming.pop("customerId", None); data.pop("customerId", None)
                if any(str(data.get(k)) != str(v) and not (k in {"amount", "totalSpent"} and Decimal(str(data[k])) == Decimal(str(v))) for k, v in incoming.items()): conflicts.append(f"Changed {kind} source ID {item.id}; existing account record preserved")
                continue
            if kind == "customer" and db.scalar(select(CustomerRecord.id).where(CustomerRecord.owner_id == owner_id, CustomerRecord.email == item.email)):
                conflicts.append(f"Email conflict for customer source ID {item.id}"); continue
            if kind == "transaction" and item.customerId is not None:
                conflicts.append(f"Transaction source ID {item.id}: legacy relationships need explicit account mapping"); continue
            additions.append((kind, item))
    return conflicts, additions


def preview_token(body, db, owner_id):
    import json
    source = body.model_dump(mode="json", exclude={"confirm", "previewToken"})
    existing = account_data(type("Owner", (), {"owner_id": owner_id})(), db)
    return hashlib.sha256(json.dumps([owner_id, source, existing], sort_keys=True).encode()).hexdigest()


@router.post("/account/import/preview")
def preview_import(body: ImportBody, session=Depends(current_session), db: Session = Depends(get_db)):
    conflicts, additions = import_plan(body, db, session.owner_id)
    return {"conflicts": conflicts, "newCustomers": sum(k == "customer" for k, _ in additions), "newTransactions": sum(k == "transaction" for k, _ in additions), "skipped": len(body.customers) + len(body.transactions) - len(additions) - len(conflicts), "previewToken": preview_token(body, db, session.owner_id)}


@router.post("/account/import")
def import_records(body: ImportBody, session=Depends(current_session), db: Session = Depends(get_db)):
    if not body.confirm or not body.previewToken: raise HTTPException(422, "Preview and explicit confirmation are required")
    # Serialize imports per user on PostgreSQL; unique constraints also protect races.
    db.scalar(select(User).where(User.id == session.owner_id).with_for_update())
    if not hmac.compare_digest(body.previewToken, preview_token(body, db, session.owner_id)): raise HTTPException(409, "Data changed since preview. Preview again.")
    conflicts, additions = import_plan(body, db, session.owner_id)
    if conflicts: raise HTTPException(409, {"message": "Import has conflicts; no records were changed", "conflicts": conflicts})
    for kind, item in additions:
        if kind == "customer":
            row = CustomerRecord(owner_id=session.owner_id, legacy_id=str(item.id), created_at=item.createdAt)
            apply_customer(row, item)
        else:
            row = TransactionRecord(owner_id=session.owner_id, legacy_id=str(item.id))
            apply_transaction(db, session.owner_id, row, item)
        db.add(row)
    commit(db)
    return {"imported": len(additions), "preservedLocalStorage": True}


def snapshot(db, owner_id, period, end, zone):
    """Calculate from owner-scoped rows in integer cents, never from model output.

    Legacy numeric fields remain for existing clients. Exact cent strings avoid
    precision loss when JavaScript receives aggregates above its safe integer range.
    """
    try:
        timezone_info = ZoneInfo(zone)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(422, "Unknown IANA time zone")
    try:
        days = int(period[:-1])
        start = end - timedelta(days=days - 1)
        previous_start = start - timedelta(days=days)
    except (ValueError, OverflowError):
        raise HTTPException(422, "Invalid reporting period")
    transactions = db.scalars(select(TransactionRecord).where(TransactionRecord.owner_id == owner_id)).all()
    customers = db.scalars(select(CustomerRecord).where(CustomerRecord.owner_id == owner_id)).all()

    def exact(rows):
        income = sum(t.amount_cents for t in rows if t.type == "income")
        expenses = sum(t.amount_cents for t in rows if t.type == "expense")
        return {
            "revenueCents": str(income), "expenseCents": str(expenses),
            "netProfitCents": str(income - expenses), "transactionCount": len(rows),
            "incomeCount": sum(t.type == "income" for t in rows),
            "expenseCount": sum(t.type == "expense" for t in rows),
        }

    def legacy_totals(rows):
        values = exact(rows)
        return {
            "totalIncome": int(values["revenueCents"]) / 100,
            "totalExpenses": int(values["expenseCents"]) / 100,
            "netProfit": int(values["netProfitCents"]) / 100,
        }

    selected = [t for t in transactions if start <= t.date <= end]
    previous = [t for t in transactions if previous_start <= t.date < start]
    registrations = sum(
        c.created_at is not None and start <= c.created_at.replace(
            tzinfo=c.created_at.tzinfo or timezone.utc
        ).astimezone(timezone_info).date() <= end for c in customers
    )
    categories = defaultdict(int)
    for transaction in selected:
        if transaction.type == "expense":
            categories[transaction.category] += transaction.amount_cents
    return {
        "currency": "EUR",
        "reportingPeriod": {"start": start.isoformat(), "end": end.isoformat(), "period": period, "timezone": zone},
        "metrics": exact(selected), "previousMetrics": exact(previous),
        "availability": {
            "previousPeriod": bool(previous), "expenseCategories": bool(categories),
            "selectedPeriod": bool(selected), "orders": False, "conversions": False,
        },
        "context": {
            "currency": "EUR", "allTime": legacy_totals(transactions),
            "selected": {
                "period": period, "start": start.isoformat(), "end": end.isoformat(),
                **legacy_totals(selected), "transactionCount": len(selected), "newCustomers": registrations,
            },
            "totalCustomers": len(customers),
            "activeCustomers": sum(c.status == "Active" for c in customers),
            "undatedCustomers": sum(c.created_at is None for c in customers),
        },
        "previousPeriod": {
            "start": previous_start.isoformat(), "end": (start - timedelta(days=1)).isoformat(),
            **legacy_totals(previous),
        },
        "expenseCategories": [
            {"category": category, "amount": cents / 100, "amountCents": str(cents)}
            for category, cents in sorted(categories.items(), key=lambda item: -item[1])
        ],
        "timezone": zone,
    }


@router.get("/account/snapshot")
def account_snapshot(period: Literal["7D", "30D", "90D"] = "30D", end: date | None = None, zone: str = Query("UTC", max_length=100), session=Depends(current_session), db: Session = Depends(get_db)):
    if end is None:
        try: end = datetime.now(ZoneInfo(zone)).date()
        except (ZoneInfoNotFoundError, ValueError): raise HTTPException(422, "Unknown IANA time zone")
    return snapshot(db, session.owner_id, period, end, zone)
