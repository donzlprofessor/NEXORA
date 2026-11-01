"""Initial account tables. Additive only; no existing local data is touched."""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None


def upgrade():
    op.create_table("users", sa.Column("id", sa.Integer, primary_key=True), sa.Column("email", sa.String(254), nullable=False, unique=True), sa.Column("password_hash", sa.String(255), nullable=False), sa.Column("name", sa.String(80), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("login_sessions", sa.Column("token_hash", sa.String(64), primary_key=True), sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False), sa.Column("csrf", sa.String(64), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_login_sessions_owner_id", "login_sessions", ["owner_id"])
    op.create_index("ix_login_sessions_expires_at", "login_sessions", ["expires_at"])
    op.create_table("customers", sa.Column("id", sa.Integer, primary_key=True), sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False), sa.Column("legacy_id", sa.String(100)), sa.Column("name", sa.String(100), nullable=False), sa.Column("email", sa.String(254), nullable=False), sa.Column("company", sa.String(100), nullable=False), sa.Column("status", sa.String(16), nullable=False), sa.Column("total_spent_cents", sa.BigInteger, nullable=False), sa.Column("created_at", sa.DateTime(timezone=True)), sa.UniqueConstraint("owner_id", "email"), sa.UniqueConstraint("owner_id", "legacy_id"), sa.UniqueConstraint("owner_id", "id"), sa.CheckConstraint("total_spent_cents >= 0"), sa.CheckConstraint("status IN ('Active','Inactive','Lead')"))
    op.create_index("ix_customers_owner_id", "customers", ["owner_id"])
    op.create_index("ix_customers_owner_name", "customers", ["owner_id", "name"])
    op.create_table("transactions", sa.Column("id", sa.Integer, primary_key=True), sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False), sa.Column("customer_id", sa.Integer), sa.Column("legacy_id", sa.String(100)), sa.Column("description", sa.String(200), nullable=False), sa.Column("category", sa.String(200), nullable=False), sa.Column("amount_cents", sa.BigInteger, nullable=False), sa.Column("type", sa.String(8), nullable=False), sa.Column("date", sa.Date, nullable=False), sa.UniqueConstraint("owner_id", "legacy_id"), sa.ForeignKeyConstraint(["owner_id", "customer_id"], ["customers.owner_id", "customers.id"]), sa.CheckConstraint("amount_cents >= 0"), sa.CheckConstraint("type IN ('income','expense')"))
    op.create_index("ix_transactions_owner_id", "transactions", ["owner_id"])
    op.create_index("ix_transactions_owner_date", "transactions", ["owner_id", "date"])
    op.create_index("ix_transactions_owner_category", "transactions", ["owner_id", "category"])
    op.create_table("preferences", sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), primary_key=True), sa.Column("values", sa.JSON, nullable=False))


def downgrade():
    raise RuntimeError("Destructive downgrade disabled. Restore a verified database backup instead.")
