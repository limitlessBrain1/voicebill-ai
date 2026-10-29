from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Product(Base):
    __tablename__ = "products"

    __table_args__ = (
        CheckConstraint("purchase_price >= 0", name="ck_products_purchase_price_non_negative"),
        CheckConstraint("selling_price >= 0", name="ck_products_selling_price_non_negative"),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id"),
        nullable=False,
        index=True,
    )

    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"),
        nullable=True,
        index=True,
    )

    purchase_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    selling_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    pack_size: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        default=Decimal("1.000"),
        server_default="1",
        nullable=False,
    )

    unit: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )


    stock_quantity: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        default=Decimal("0.000"),
        server_default="0",
        nullable=False,
    )

    low_stock_threshold: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        default=Decimal("0.000"),
        server_default="0",
        nullable=False,
    )

    barcode: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
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
