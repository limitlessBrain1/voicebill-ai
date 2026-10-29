from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class CheckoutRequest(BaseModel):
    payment_method: Literal["cash", "upi"] = Field(
        ...,
        description="Payment method used for checkout: 'cash' or 'upi'",
        examples=["cash"],
    )
    amount_received: Optional[Decimal] = Field(
        None,
        ge=Decimal("0.00"),
        decimal_places=2,
        description="Cash received from customer (required if payment_method is 'cash')",
    )
    payment_reference: Optional[str] = Field(
        None,
        max_length=100,
        description="UPI transaction reference / UTR or reference note",
    )
    notes: Optional[str] = Field(
        None,
        max_length=255,
        description="Optional cashier notes for the sale",
    )

    @model_validator(mode="after")
    def validate_payment_inputs(self):
        if self.payment_method == "cash" and self.amount_received is None:
            raise ValueError("amount_received is required for cash payments.")
        return self


class SaleItemResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    product_name: str
    unit: str
    unit_price: Decimal
    quantity: Decimal
    line_total: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaymentResponse(BaseModel):
    id: int
    sale_id: int
    shop_id: int
    payment_method: str
    amount: Decimal
    status: str
    reference: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SaleShopResponse(BaseModel):
    id: int
    name: str
    owner_name: str
    phone: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    gst_number: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SaleResponse(BaseModel):
    id: int
    receipt_number: str
    shop_id: int
    user_id: int
    cart_id: Optional[int] = None
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    payment_method: str
    payment_status: str
    amount_received: Optional[Decimal] = None
    change_due: Optional[Decimal] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: list[SaleItemResponse] = []
    payments: list[PaymentResponse] = []
    shop: Optional[SaleShopResponse] = None

    model_config = ConfigDict(from_attributes=True)


class SalesListResponse(BaseModel):
    sales: list[SaleResponse]
    total_count: int
    limit: int = 20
    offset: int = 0

