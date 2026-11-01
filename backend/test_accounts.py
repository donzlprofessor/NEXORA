import os
import tempfile
import unittest
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import main
import accounts
from database import Base, LoginSession, User, get_db, utcnow


class AccountsTests(unittest.TestCase):
    def setUp(self):
        accounts._attempts.clear()
        postgres = os.getenv("NEXORA_TEST_POSTGRES_URL")
        if postgres:
            # Only an explicitly named disposable CI database may be used here.
            if not postgres.endswith("/nexora_ci"): raise RuntimeError("Use the isolated nexora_ci database for PostgreSQL tests")
            self.engine = create_engine(postgres)
            self.connection = self.engine.connect()
            self.transaction_boundary = self.connection.begin()
        else:
            self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
            event.listen(self.engine, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON"))
            Base.metadata.create_all(self.engine)
            self.connection = None
        def database():
            with self.session() as db: yield db
        main.app.dependency_overrides[get_db] = database
        self.client = TestClient(main.app)
        self.csrf = None

    def session(self):
        return Session(self.connection if self.connection is not None else self.engine, expire_on_commit=False, join_transaction_mode="create_savepoint")

    def tearDown(self):
        main.app.dependency_overrides.clear()
        self.client.close()
        if self.connection is not None:
            self.transaction_boundary.rollback()
            self.connection.close()
        self.engine.dispose()

    def signup(self, email="alice@example.com"):
        result = self.client.post("/api/auth/register", json={"email": email, "password": "testing-password-long", "name": "Alice"})
        self.assertEqual(result.status_code, 201, result.text)
        self.csrf = result.json()["csrf"]
        return result

    def write(self, method, path, body=None):
        return self.client.request(method, path, json=body, headers={"X-CSRF-Token": self.csrf or ""})

    def customer(self):
        return {"name": "Customer", "email": "customer@example.com", "company": "Test", "status": "Active", "totalSpent": 10.25}

    def transaction(self):
        return {"description": "Service", "category": "Services", "amount": 10.25, "type": "income", "date": "2026-11-01"}

    def test_registration_hashing_login_logout_and_expiry(self):
        response = self.signup()
        self.assertIn("HttpOnly", response.headers["set-cookie"])
        with self.session() as db:
            user = db.scalar(select(User))
            self.assertNotIn("testing-password", user.password_hash)
            self.assertTrue(user.password_hash.startswith("$argon2"))
        self.assertEqual(self.client.get("/api/auth/me").status_code, 200)
        self.assertEqual(self.write("POST", "/api/auth/logout").status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)
        result = self.client.post("/api/auth/login", json={"email": "ALICE@example.com", "password": "testing-password-long"})
        self.assertEqual(result.status_code, 200)
        with self.session() as db:
            for row in db.scalars(select(LoginSession)): row.expires_at = utcnow()-timedelta(seconds=1)
            db.commit()
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_csrf_origin_and_unauthenticated_requests(self):
        self.assertEqual(self.client.get("/api/account/customers").status_code, 401)
        self.signup()
        self.assertEqual(self.client.post("/api/account/customers", json=self.customer()).status_code, 403)
        self.assertEqual(self.client.post("/api/account/customers", json=self.customer(), headers={"Origin": "https://attacker.example", "X-CSRF-Token": self.csrf}).status_code, 403)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "alice@example.com", "password": "wrong-password-long"}).status_code, 401)

    def test_invalid_registration_and_duplicate_normalized_email(self):
        self.assertEqual(self.client.post("/api/auth/register", json={"email": "not-email", "password": "short", "name": "Test"}).status_code, 422)
        self.signup()
        self.assertEqual(self.client.post("/api/auth/register", json={"email": " ALICE@example.com ", "password": "different-long-password", "name": "Other"}).status_code, 409)

    def test_login_rotates_session_and_revokes_previous_browser_token(self):
        self.signup()
        previous = self.client.cookies.get(accounts.COOKIE)
        result = self.client.post("/api/auth/login", json={"email": "alice@example.com", "password": "testing-password-long"})
        self.assertEqual(result.status_code, 200)
        self.assertNotEqual(previous, self.client.cookies.get(accounts.COOKIE))
        with TestClient(main.app) as old_browser:
            old_browser.cookies.set(accounts.COOKIE, previous)
            self.assertEqual(old_browser.get("/api/auth/me").status_code, 401)

    def test_authentication_attempts_are_bounded(self):
        with patch.object(accounts.passwords, "verify", return_value=False):
            results = [self.client.post("/api/auth/login", json={"email": "missing@example.com", "password": "wrong-password-long"}).status_code for _ in range(16)]
        self.assertEqual(results[-1], 429)

    def test_cross_account_crud_relationship_and_preferences_isolation(self):
        self.signup()
        c = self.write("POST", "/api/account/customers", self.customer()).json()
        t = self.write("POST", "/api/account/transactions", self.transaction()).json()
        self.signup("bob@example.com")
        self.assertEqual(self.client.get("/api/account/data").json()["customers"], [])
        for resource, identifier, body in [("customers", c["id"], self.customer()), ("transactions", t["id"], self.transaction())]:
            self.assertEqual(self.client.get(f"/api/account/{resource}/{identifier}").status_code, 404)
            self.assertEqual(self.write("PUT", f"/api/account/{resource}/{identifier}", body).status_code, 404)
            self.assertEqual(self.write("DELETE", f"/api/account/{resource}/{identifier}").status_code, 404)
        self.assertEqual(self.write("POST", "/api/account/transactions", {**self.transaction(), "customerId": c["id"]}).status_code, 404)
        self.assertEqual(self.client.get("/api/account/preferences").json()["name"], "Alice")

    def test_validation_filtering_sorting_pagination_and_precision(self):
        self.signup()
        self.assertEqual(self.write("POST", "/api/account/transactions", {**self.transaction(), "amount": 1.001}).status_code, 422)
        self.assertEqual(self.write("POST", "/api/account/transactions", {**self.transaction(), "date": "2026-02-30"}).status_code, 422)
        for amount in [0.1, 0.2]: self.assertEqual(self.write("POST", "/api/account/transactions", {**self.transaction(), "amount": amount}).status_code, 201)
        result = self.client.get("/api/account/transactions?sort=amount&size=1").json()
        self.assertEqual(result["total"], 2)
        self.assertEqual(result["items"][0]["amount"], 0.2)
        snapshot = self.client.get("/api/account/snapshot?period=7D&end=2026-11-01&zone=Europe/Warsaw").json()
        self.assertEqual(snapshot["context"]["selected"]["totalIncome"], 0.3)
        self.assertEqual(self.client.get("/api/account/transactions?search=missing").json()["total"], 0)

    def test_duplicate_email_and_linked_customer_constraint(self):
        self.signup()
        c = self.write("POST", "/api/account/customers", self.customer()).json()
        self.assertEqual(self.write("POST", "/api/account/customers", self.customer()).status_code, 409)
        self.write("POST", "/api/account/transactions", {**self.transaction(), "customerId": c["id"]})
        self.assertEqual(self.write("DELETE", f'/api/account/customers/{c["id"]}').status_code, 409)

    def test_import_preview_confirmation_idempotency_and_conflicts(self):
        self.signup()
        source = {"version": 1, "currency": "EUR", "customers": [{"id": 42, **self.customer()}], "transactions": [{"id": 73, **self.transaction()}]}
        self.assertEqual(self.write("POST", "/api/account/import", source).status_code, 422)
        preview = self.write("POST", "/api/account/import/preview", source).json()
        self.assertEqual(preview["newCustomers"], 1)
        self.assertEqual(self.client.get("/api/account/data").json()["customers"], [])
        result = self.write("POST", "/api/account/import", {**source, "confirm": True, "previewToken": preview["previewToken"]})
        self.assertEqual(result.status_code, 200, result.text)
        preview = self.write("POST", "/api/account/import/preview", source).json()
        self.assertEqual(preview["skipped"], 2)
        self.assertEqual(self.write("POST", "/api/account/import", {**source, "confirm": True, "previewToken": preview["previewToken"]}).json()["imported"], 0)
        self.assertNotIn("createdAt", self.client.get("/api/account/data").json()["customers"][0])
        changed = {**source, "transactions": [{"id": 73, **self.transaction(), "amount": 999}]}
        preview = self.write("POST", "/api/account/import/preview", changed).json()
        self.assertTrue(preview["conflicts"])
        self.assertEqual(self.write("POST", "/api/account/import", {**changed, "confirm": True, "previewToken": preview["previewToken"]}).status_code, 409)
        self.assertEqual(self.client.get("/api/account/data").json()["transactions"][0]["amount"], 10.25)

    def test_stale_import_preview_cannot_overwrite_changes(self):
        self.signup()
        source = {"version": 1, "currency": "EUR", "customers": [], "transactions": [{"id": 73, **self.transaction()}]}
        token = self.write("POST", "/api/account/import/preview", source).json()["previewToken"]
        self.write("POST", "/api/account/transactions", self.transaction())
        self.assertEqual(self.write("POST", "/api/account/import", {**source, "confirm": True, "previewToken": token}).status_code, 409)

    def test_ai_uses_server_totals_and_rejects_client_totals(self):
        self.signup()
        self.write("POST", "/api/account/transactions", self.transaction())
        request = {"messages": [{"role": "user", "content": "Summary"}], "period": "7D", "end": "2026-11-01", "zone": "UTC"}
        with patch.object(main, "generate", AsyncMock(return_value="Review the verified snapshot.")) as generate:
            result = self.write("POST", "/api/account/chat", request)
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(generate.call_args.args[0].context.selected.totalIncome, 10.25)
            self.assertEqual(result.json()["snapshot"]["context"]["selected"]["totalIncome"], 10.25)
        self.assertEqual(self.write("POST", "/api/account/chat", {**request, "context": {"totalIncome": 999999}}).status_code, 422)

    def test_snapshot_comparison_categories_and_timezones_are_owner_scoped(self):
        self.signup()
        for amount, kind, day, category in [(100, "income", "2026-11-01", "Services"), (20, "expense", "2026-10-26", "Software"), (10, "expense", "2026-10-27", "Software"), (50, "income", "2026-10-25", "Services")]:
            self.write("POST", "/api/account/transactions", {**self.transaction(), "amount": amount, "type": kind, "date": day, "category": category})
        result = self.client.get("/api/account/snapshot?period=7D&end=2026-11-01&zone=Europe/Warsaw").json()
        self.assertEqual(result["context"]["selected"]["netProfit"], 70)
        self.assertEqual(result["previousPeriod"]["totalIncome"], 50)
        self.assertEqual(result["expenseCategories"], [{"category": "Software", "amount": 30, "amountCents": "3000"}])
        self.assertEqual(self.client.get("/api/account/snapshot?zone=/invalid").status_code, 422)
        self.signup("other@example.com")
        result = self.client.get("/api/account/snapshot?period=7D&end=2026-11-01").json()
        self.assertEqual(result["context"]["allTime"]["totalIncome"], 0)
        self.assertEqual(result["expenseCategories"], [])

    def test_import_never_silently_changes_historical_dates(self):
        self.signup()
        source = {"version": 1, "currency": "EUR", "customers": [{"id": 42, **self.customer(), "createdAt": "2026-01-01T00:00:00Z"}], "transactions": []}
        preview = self.write("POST", "/api/account/import/preview", source).json()
        self.assertEqual(self.write("POST", "/api/account/import", {**source, "confirm": True, "previewToken": preview["previewToken"]}).status_code, 200)
        source["customers"][0]["createdAt"] = "2026-02-01T00:00:00Z"
        preview = self.write("POST", "/api/account/import/preview", source).json()
        self.assertIn("histor", " ".join(preview["conflicts"]))
        self.assertEqual(self.write("POST", "/api/account/import", {**source, "confirm": True, "previewToken": preview["previewToken"]}).status_code, 409)

    def test_public_mode_never_calls_ollama(self):
        self.signup()
        with patch.dict(os.environ, {"AI_MODE": "disabled"}), patch.object(main, "generate", AsyncMock()) as generate:
            result = self.write("POST", "/api/account/chat", {"messages": [{"role": "user", "content": "Hi"}]})
            self.assertEqual(result.status_code, 503)
            generate.assert_not_called()


class MigrationTests(unittest.TestCase):
    def test_additive_migration_and_persistence_on_isolated_database(self):
        with tempfile.TemporaryDirectory() as directory:
            url = "sqlite:///" + directory.replace("\\", "/") + "/migration-test.db"
            config = Config(os.path.join(os.path.dirname(__file__), "alembic.ini"))
            with patch.dict(os.environ, {"DATABASE_URL": url}):
                command.upgrade(config, "head")
                command.upgrade(config, "head")
            engine = create_engine(url)
            with Session(engine) as db:
                db.add(User(email="persist@example.com", password_hash="test-only-not-a-password", name="Persist")); db.commit()
            with Session(engine) as db:
                self.assertEqual(db.scalar(select(User)).name, "Persist")
            engine.dispose()
