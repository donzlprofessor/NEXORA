"""Database setup is lazy; no automatic schema creation or destructive operations."""
import os
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, JSON, String, UniqueConstraint, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


def utcnow():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    customers: Mapped[list["CustomerRecord"]] = relationship(back_populates="owner")
    transactions: Mapped[list["TransactionRecord"]] = relationship(back_populates="owner")
    preference: Mapped["PreferenceRecord"] = relationship(back_populates="owner", uselist=False)


class LoginSession(Base):
    __tablename__ = "login_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    csrf: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class CustomerRecord(Base):
    __tablename__ = "customers"
    __table_args__ = (UniqueConstraint("owner_id", "email"), UniqueConstraint("owner_id", "legacy_id"), UniqueConstraint("owner_id", "id"), CheckConstraint("total_spent_cents >= 0"), CheckConstraint("status IN ('Active','Inactive','Lead')"), Index("ix_customers_owner_name", "owner_id", "name"))
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    legacy_id: Mapped[str | None] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(254))
    company: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(16))
    total_spent_cents: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    owner: Mapped[User] = relationship(back_populates="customers")


class TransactionRecord(Base):
    __tablename__ = "transactions"
    __table_args__ = (UniqueConstraint("owner_id", "legacy_id"), ForeignKeyConstraint(["owner_id", "customer_id"], ["customers.owner_id", "customers.id"]), CheckConstraint("amount_cents >= 0"), CheckConstraint("type IN ('income','expense')"), Index("ix_transactions_owner_date", "owner_id", "date"), Index("ix_transactions_owner_category", "owner_id", "category"))
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    customer_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    legacy_id: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(200))
    amount_cents: Mapped[int] = mapped_column(BigInteger)
    type: Mapped[str] = mapped_column(String(8))
    date: Mapped[date] = mapped_column(Date)
    owner: Mapped[User] = relationship(back_populates="transactions")


class PreferenceRecord(Base):
    __tablename__ = "preferences"
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    values: Mapped[dict] = mapped_column(JSON, default=dict)
    owner: Mapped[User] = relationship(back_populates="preference")


_factory = None


def get_db():
    global _factory
    if _factory is None:
        url = os.getenv("DATABASE_URL")
        if not url:
            raise HTTPException(503, "Account database is not configured. Local demo data remains available.")
        if not url.startswith("postgresql+psycopg://"):
            raise HTTPException(503, "Account mode requires a PostgreSQL DATABASE_URL.")
        _factory = sessionmaker(create_engine(url, pool_pre_ping=True, pool_timeout=10, connect_args={"connect_timeout": 10}), expire_on_commit=False)
    with _factory() as session:
        yield session
