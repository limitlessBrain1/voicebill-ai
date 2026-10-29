from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class CartCreate(BaseModel):
    """Optional payload for cart creation."""
    pass


class CartItemCreate(BaseModel):
    product_id: int
    quantity: Decimal = Field(gt=Decimal("0"), decimal_places=3)


class CartItemUpdate(BaseModel):
    quantity: Decimal = Field(gt=Decimal("0"), decimal_places=3)


class CartItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: Decimal
    unit: str
    unit_price: Decimal
    line_total: Decimal
    pack_size: Decimal | None = None
    stock_quantity: Decimal | None = None

    model_config = ConfigDict(from_attributes=True)


class CartResponse(BaseModel):
    id: int
    shop_id: int
    user_id: int
    status: str
    items: list[CartItemResponse] = []
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
