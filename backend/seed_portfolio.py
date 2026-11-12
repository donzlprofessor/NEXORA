"""Opt-in, additive local portfolio fixtures. Importing this module performs no I/O."""
import argparse
import os
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from accounts import CustomerInput, TransactionInput, apply_customer, apply_transaction, normalized_email
from database import CustomerRecord, TransactionRecord, User

PREFIX = "nexora-portfolio-v1:"
ZONE = ZoneInfo("Europe/Warsaw")
COMPANIES = (
    "Amber Quill", "Birch Lantern", "Cobalt Meadow", "Driftwood Atlas", "Elm Compass",
    "Fern Harbour", "Golden Loom", "Hazel Orbit", "Indigo Orchard", "Juniper Studio",
    "Kestrel Paper", "Linden Workshop", "Marble Finch", "North Willow", "Ochre Bridge",
    "Pebble Grove", "Quiet Maple", "Reed Pavilion", "Silver Acorn", "Thistle Works",
    "Umber Field", "Velvet Cedar", "Woven Horizon", "Yellow Spruce", "Zephyr Canvas",
)
NAMES = (
    "Ada Vale", "Bruno Reed", "Clara Finch", "Dario Moss", "Elena Brook",
    "Felix Wren", "Greta Lane", "Hugo Alder", "Iris Stone", "Jonas Birch",
    "Kira Dale", "Leon Ash", "Marta Elm", "Nico Grey", "Olivia Fern",
    "Pavel Lake", "Quinn Holt", "Rosa Pine", "Simon Wood", "Tessa Hill",
    "Uma Field", "Victor Glen", "Willa Frost", "Yara Bloom", "Zeno Marsh",
)


def dataset(end: date):
    """Deterministic identities and cents; dates span today and the preceding 89 days."""
    customers = []
    transactions = []
    spending = [0] * 25
    for i in range(84):
        income = i % 7 < 4
        customer_index = (i // 7 * 4 + i % 7) % 18 if income else None
        cents = (65000 + (i * 13729) % 385000) if income else (1900 + (i * 7919) % 145000)
        day = end - timedelta(days=89 - (i * 89 // 83))
        if income:
            spending[customer_index] += cents
            category = ("Services", "Consulting", "Design")[i % 3]
            description = f"{COMPANIES[customer_index]} — {category.lower()} milestone"
        else:
            category = ("Software", "Marketing", "Equipment", "Office", "Professional services", "Travel")[i % 6]
            description = f"{category} — studio operating cost"
        transactions.append((PREFIX + f"transaction:{i + 1:03}", customer_index, TransactionInput(
            description=f"[Fictional] {description}", category=category,
            amount=Decimal(cents) / 100, type="income" if income else "expense", date=day,
        )))
    for i, (name, company) in enumerate(zip(NAMES, COMPANIES)):
        # Linked customers register before their first invoice; leads register later.
        first_invoice = min((body.date for _, index, body in transactions if index == i), default=None)
        offset = min(89, (end - first_invoice).days + 2) if first_invoice else 89 - ((i - 17) * 11)
        customers.append((PREFIX + f"customer:{i + 1:03}", CustomerInput(
            name=name, email=f"portfolio.v1.{i + 1:02}@example.com",
            company=f"{company} (Fictional)",
            status="Active" if i < 18 else "Inactive" if i < 21 else "Lead",
            totalSpent=Decimal(spending[i]) / 100,
            createdAt=datetime.combine(end - timedelta(days=offset), time(9), tzinfo=ZONE),
        )))
    return customers, transactions


def local_database_url(raw):
    """Disallow remote hosts and connection query overrides (host/service/options)."""
    try:
        url = make_url(raw)
        valid = (url.drivername == "postgresql+psycopg" and
                 url.host in {"localhost", "127.0.0.1", "::1"} and
                 bool(url.database) and not url.query)
    except Exception:
        valid = False
    if not valid:
        raise ValueError("Use a loopback postgresql+psycopg DATABASE_URL without query parameters.")
    return url


def seed(db: Session, user_id: int, email: str, end: date, *, apply=False):
    """Plan or insert in the caller's transaction; never commit or modify existing rows."""
    email = normalized_email(email)
    query = select(User).where(User.id == user_id, User.email == email)
    if apply:
        query = query.with_for_update()
    if db.scalar(query) is None:
        raise ValueError("User ID and email must match one existing account; nothing was changed.")
    customers, transactions = dataset(end)
    existing_customers = {row.legacy_id: row for row in db.scalars(
        select(CustomerRecord).where(CustomerRecord.owner_id == user_id)
    ) if row.legacy_id}
    existing_transactions = set(db.scalars(select(TransactionRecord.legacy_id).where(
        TransactionRecord.owner_id == user_id, TransactionRecord.legacy_id.is_not(None)
    )))
    emails = set(db.scalars(select(CustomerRecord.email).where(CustomerRecord.owner_id == user_id)))
    new_customers = [(key, body) for key, body in customers if key not in existing_customers]
    for _, body in new_customers:
        if body.email in emails:
            raise ValueError("A fictional customer email conflicts with an existing record; nothing was changed.")
    new_transactions = [(key, index, body) for key, index, body in transactions if key not in existing_transactions]
    report = {
        "mode": "apply" if apply else "read-only preview",
        "user_id": user_id, "email": email,
        "start": (end - timedelta(days=89)).isoformat(), "end": end.isoformat(),
        "timezone": "Europe/Warsaw", "currency": "EUR",
        "new_customers": len(new_customers), "new_transactions": len(new_transactions),
        "skipped": 109 - len(new_customers) - len(new_transactions), "conflicts": 0,
    }
    if not apply:
        return report
    for key, body in new_customers:
        row = CustomerRecord(owner_id=user_id, legacy_id=key, created_at=body.createdAt)
        apply_customer(row, body)
        db.add(row)
        existing_customers[key] = row
    db.flush()
    for key, index, body in new_transactions:
        if index is not None:
            body = body.model_copy(update={"customerId": existing_customers[customers[index][0]].id})
        row = TransactionRecord(owner_id=user_id, legacy_id=key)
        apply_transaction(db, user_id, row, body)
        db.add(row)
    db.flush()
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user-id", type=int, required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--end-date", type=date.fromisoformat, default=None,
                        help="Optional reproducible reporting date (YYYY-MM-DD); defaults to today in Warsaw")
    parser.add_argument("--apply", action="store_true", help="Explicitly insert additions; default is read-only")
    args = parser.parse_args(argv)
    engine = None
    try:
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).with_name(".env"), override=False)
        if os.getenv("NEXORA_LOCAL_SEED") != "1":
            raise ValueError("Set NEXORA_LOCAL_SEED=1 to explicitly opt into local development seeding.")
        if args.user_id <= 0:
            raise ValueError("User ID must be positive.")
        end = args.end_date or datetime.now(ZONE).date()
        if end > datetime.now(ZONE).date():
            raise ValueError("The reporting end date cannot be in the future.")
        if end < date.min + timedelta(days=89):
            raise ValueError("The reporting end date must allow a full 90-day range.")
        url = local_database_url(os.getenv("DATABASE_URL", ""))
        # Do not permit libpq environment variables to redirect a loopback URL.
        if any(os.getenv(key) for key in ("PGHOST", "PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGOPTIONS")):
            raise ValueError("Unset libpq host/service/options overrides before using this local tool.")
        engine = create_engine(url, connect_args={"connect_timeout": 10}, echo=False)
        with Session(engine) as db:
            with db.begin():
                if not args.apply:
                    db.execute(text("SET TRANSACTION READ ONLY"))
                report = seed(db, args.user_id, args.email, end, apply=args.apply)
        import json
        print(json.dumps(report, indent=2))
        return 0
    except ValueError as error:
        # Validation messages are authored above; never expose connection details.
        print(f"Seed refused: {error}")
        return 1
    except SQLAlchemyError:
        print("Database operation failed; transaction rolled back. Check local configuration and schema. Connection details withheld.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
