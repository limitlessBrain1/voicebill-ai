from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    receipt_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )

    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    cart_id: Mapped[int | None] = mapped_column(
        ForeignKey("billing_carts.id"),
        nullable=True,
        index=True,
    )

    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        server_default="0.00",
        nullable=False,
    )

    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        server_default="0.00",
        nullable=False,
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    payment_method: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    payment_status: Mapped[str] = mapped_column(
        String(50),
        default="completed",
        server_default="completed",
        nullable=False,
    )

    amount_received: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        nullable=True,
    )

    change_due: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        server_default="0.00",
        nullable=True,
    )

    payment_reference: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    items: Mapped[list["SaleItem"]] = relationship(
        back_populates="sale",
        cascade="all, delete-orphan",
        order_by="SaleItem.id.asc()",
    )

    payments: Mapped[list["Payment"]] = relationship(
        back_populates="sale",
        cascade="all, delete-orphan",
        order_by="Payment.id.asc()",
    )

    shop = relationship("Shop")
    user = relationship("User")
    cart = relationship("BillingCart")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    sale_id: Mapped[int] = mapped_column(
        ForeignKey("sales.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id"),
        nullable=True,
        index=True,
    )

    # Historical Snapshots
    product_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    unit: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False,
    )

    line_total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    sale: Mapped["Sale"] = relationship(
        back_populates="items",
    )

    product = relationship("Product", lazy="joined")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    sale_id: Mapped[int] = mapped_column(
        ForeignKey("sales.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id"),
        nullable=False,
        index=True,
    )

    payment_method: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="completed",
        server_default="completed",
        nullable=False,
    )

    reference: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    sale: Mapped["Sale"] = relationship(
        back_populates="payments",
    )

    shop = relationship("Shop")
