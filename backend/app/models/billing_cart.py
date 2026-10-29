from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class BillingCart(Base):
    __tablename__ = "billing_carts"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
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

    status: Mapped[str] = mapped_column(
        String(50),
        default="draft",
        server_default="draft",
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
    items: Mapped[list["BillingCartItem"]] = relationship(
        back_populates="cart",
        cascade="all, delete-orphan",
        order_by="BillingCartItem.id.asc()",
    )

    shop = relationship("Shop")
    user = relationship("User")


class BillingCartItem(Base):
    __tablename__ = "billing_cart_items"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    cart_id: Mapped[int] = mapped_column(
        ForeignKey("billing_carts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"),
        nullable=False,
        index=True,
    )

    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False,
    )

    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    unit: Mapped[str] = mapped_column(
        String(20),
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

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    cart: Mapped["BillingCart"] = relationship(
        back_populates="items",
    )

    product = relationship("Product", lazy="joined")

    @property
    def product_name(self) -> str:
        return self.product.name if self.product else ""

    @property
    def pack_size(self) -> Decimal | None:
        return self.product.pack_size if self.product else None

    @property
    def stock_quantity(self) -> Decimal | None:
        return self.product.stock_quantity if self.product else None
