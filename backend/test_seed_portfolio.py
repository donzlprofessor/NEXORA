"""Always isolated in-memory SQLite; never reads .env or a PostgreSQL test URL."""
import unittest
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session

from database import Base, CustomerRecord, PreferenceRecord, TransactionRecord, User
from seed_portfolio import PREFIX, dataset, local_database_url, main, seed


class PortfolioSeedTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        event.listen(self.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        Base.metadata.create_all(self.engine)
        self.end = date(2026, 11, 12)
        with Session(self.engine) as db, db.begin():
            db.add_all([User(id=1, email="owner@example.com", name="Owner", password_hash="test-only"),
                        User(id=2, email="other@example.com", name="Other", password_hash="test-only")])
            db.flush()
            db.add_all([CustomerRecord(owner_id=owner, name="Existing", email="existing@example.com",
                        company="Existing", status="Active", total_spent_cents=12345) for owner in (1, 2)])
            db.add_all([TransactionRecord(owner_id=owner, description="Existing", category="Existing",
                        amount_cents=12345, type="income", date=self.end) for owner in (1, 2)])
            db.add(PreferenceRecord(owner_id=1, values={"workspace": "Preserve me"}))

    def tearDown(self):
        self.engine.dispose()

    def snapshot(self):
        with Session(self.engine) as db:
            return {table.name: [tuple(row) for row in db.execute(select(table).order_by(*table.primary_key.columns))]
                    for table in Base.metadata.sorted_tables}

    def run_seed(self, **kwargs):
        with Session(self.engine) as db, db.begin():
            return seed(db, 1, "owner@example.com", self.end, **kwargs)

    def test_preview_is_read_only(self):
        before = self.snapshot()
        report = self.run_seed()
        self.assertEqual((report["new_customers"], report["new_transactions"], report["conflicts"]), (25, 84, 0))
        self.assertEqual(before, self.snapshot())

    def test_insert_isolation_relationships_and_rerun_preserve_edits(self):
        before = self.snapshot()
        self.run_seed(apply=True)
        after = self.snapshot()
        for table, rows in before.items():
            self.assertTrue(all(row in after[table] for row in rows), table)
        with Session(self.engine) as db, db.begin():
            self.assertEqual(db.scalar(select(func.count()).select_from(CustomerRecord).where(CustomerRecord.owner_id == 2)), 1)
            self.assertEqual(db.scalar(select(func.count()).select_from(TransactionRecord).where(TransactionRecord.owner_id == 2)), 1)
            rows = db.scalars(select(TransactionRecord).where(TransactionRecord.legacy_id.like(PREFIX + "%"))).all()
            self.assertEqual(len(rows), 84)
            for row in rows:
                if row.customer_id:
                    self.assertEqual(db.get(CustomerRecord, row.customer_id).owner_id, 1)
            rows[0].description = "User edit preserved"
            customer = db.scalar(select(CustomerRecord).where(CustomerRecord.legacy_id == PREFIX + "customer:001"))
            customer.company = "User-edited company"
        edited = self.snapshot()
        self.end += timedelta(days=10)
        report = self.run_seed(apply=True)
        self.assertEqual(report["skipped"], 109)
        self.assertEqual(edited, self.snapshot())

    def test_identity_mismatch_or_missing_account_aborts(self):
        before = self.snapshot()
        for user_id, email in [(1, "other@example.com"), (999, "owner@example.com")]:
            with self.assertRaises(ValueError), Session(self.engine) as db, db.begin():
                seed(db, user_id, email, self.end, apply=True)
        self.assertEqual(before, self.snapshot())

    def test_conflicting_email_aborts_all_additions(self):
        with Session(self.engine) as db, db.begin():
            row = db.scalar(select(CustomerRecord).where(CustomerRecord.owner_id == 1))
            row.email = "portfolio.v1.25@example.com"
        before = self.snapshot()
        with self.assertRaises(ValueError):
            self.run_seed(apply=True)
        self.assertEqual(before, self.snapshot())

    def test_failure_after_customer_flush_rolls_back(self):
        before = self.snapshot()
        with patch("seed_portfolio.apply_transaction", side_effect=RuntimeError("injected failure")):
            with self.assertRaises(RuntimeError):
                self.run_seed(apply=True)
        self.assertEqual(before, self.snapshot())

    def test_dataset_validation_dates_and_money(self):
        customers, transactions = dataset(self.end)
        self.assertEqual(len(customers), 25)
        self.assertEqual(len(transactions), 84)
        self.assertEqual(len({key for key, _ in customers}), 25)
        self.assertEqual(len({key for key, _, _ in transactions}), 84)
        dates = [body.date for _, _, body in transactions]
        self.assertEqual((min(dates), max(dates)), (self.end - timedelta(days=89), self.end))
        self.assertEqual({body.status for _, body in customers}, {"Active", "Inactive", "Lead"})
        self.assertEqual({body.type for _, _, body in transactions}, {"income", "expense"})
        for index, (_, customer) in enumerate(customers):
            self.assertTrue(customer.email.endswith("@example.com"))
            self.assertIn("Fictional", customer.company)
            linked = [body for _, owner, body in transactions if owner == index]
            self.assertEqual(customer.totalSpent, sum((body.amount for body in linked), Decimal(0)))
            self.assertTrue(all(customer.createdAt.date() <= body.date for body in linked))
        for _, _, body in transactions:
            self.assertTrue(body.description.startswith("[Fictional]"))
            self.assertGreater(body.amount, 0)
            self.assertEqual(body.amount * 100, (body.amount * 100).to_integral_value())

    def test_local_url_guards(self):
        for host in ("localhost", "127.0.0.1", "[::1]"):
            local_database_url(f"postgresql+psycopg://user:password@{host}:5432/nexora")
        for raw in ("", "sqlite://", "postgresql+psycopg://host/nexora",
                    "postgresql+psycopg://localhost/nexora?host=remote",
                    "postgresql+psycopg://localhost/nexora?service=production"):
            with self.assertRaises(ValueError):
                local_database_url(raw)

    def test_cli_opt_in_required_before_connection(self):
        with patch("dotenv.load_dotenv"), patch.dict("os.environ", {}, clear=True), \
                patch("seed_portfolio.create_engine") as engine, patch("builtins.print"):
            self.assertEqual(main(["--user-id", "1", "--email", "owner@example.com"]), 1)
            engine.assert_not_called()

    def test_same_seed_keys_can_belong_to_different_owners(self):
        with Session(self.engine) as db, db.begin():
            seed(db, 2, "other@example.com", self.end, apply=True)
        before = self.snapshot()
        self.run_seed(apply=True)
        after = self.snapshot()
        for table, rows in before.items():
            self.assertTrue(all(row in after[table] for row in rows), table)
        with Session(self.engine) as db:
            for owner in (1, 2):
                self.assertEqual(db.scalar(select(func.count()).select_from(CustomerRecord).where(CustomerRecord.owner_id == owner)), 26)

    def test_cli_preview_enforces_read_only_before_planning(self):
        # Mock all connections: exercising CLI transaction setup never reaches PostgreSQL.
        with patch("dotenv.load_dotenv"), patch.dict("os.environ", {
            "NEXORA_LOCAL_SEED": "1",
            "DATABASE_URL": "postgresql+psycopg://localhost/nexora",
        }, clear=True), patch("seed_portfolio.create_engine") as engine, \
                patch("seed_portfolio.Session") as session, patch("seed_portfolio.seed") as planner, \
                patch("builtins.print"):
            db = session.return_value.__enter__.return_value
            def check_read_only(*args, **kwargs):
                self.assertEqual(str(db.execute.call_args.args[0]), "SET TRANSACTION READ ONLY")
                self.assertFalse(kwargs["apply"])
                return {}
            planner.side_effect = check_read_only
            self.assertEqual(main(["--user-id", "1", "--email", "owner@example.com"]), 0)
            engine.return_value.dispose.assert_called_once()


if __name__ == "__main__":
    unittest.main()
