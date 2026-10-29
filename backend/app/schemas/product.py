from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150, examples=["cooking oil"])
    category_id: int | None = Field(default=None, examples=[1])
    purchase_price: Decimal = Field(ge=0, decimal_places=2, examples=[Decimal("100.00")])
    selling_price: Decimal = Field(ge=0, decimal_places=2, examples=[Decimal("120.00")])
    pack_size: Decimal = Field(default=Decimal("1"), gt=0, decimal_places=3, examples=[Decimal("1.000")])
    unit: str = Field(min_length=1, max_length=20, examples=["litre"])
    stock_quantity: Decimal = Field(default=Decimal("0"), ge=0, decimal_places=3, examples=[Decimal("20.000")])
    low_stock_threshold: Decimal = Field(default=Decimal("0"), ge=0, decimal_places=3, examples=[Decimal("5.000")])
    barcode: str | None = Field(default=None, max_length=100, examples=[None])

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "cooking oil",
                "category_id": 1,
                "purchase_price": "100.00",
                "selling_price": "120.00",
                "pack_size": "1.000",
                "unit": "litre",
                "stock_quantity": "20.000",
                "low_stock_threshold": "5.000",
                "barcode": None,
            }
        }
    )


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150, examples=["cooking oil"])
    category_id: int | None = Field(default=None, examples=[1])
    purchase_price: Decimal | None = Field(default=None, ge=0, decimal_places=2, examples=[Decimal("100.00")])
    selling_price: Decimal | None = Field(default=None, ge=0, decimal_places=2, examples=[Decimal("120.00")])
    pack_size: Decimal | None = Field(default=None, gt=0, decimal_places=3, examples=[Decimal("1.000")])
    unit: str | None = Field(default=None, min_length=1, max_length=20, examples=["litre"])
    stock_quantity: Decimal | None = Field(default=None, ge=0, decimal_places=3, examples=[Decimal("20.000")])
    low_stock_threshold: Decimal | None = Field(default=None, ge=0, decimal_places=3, examples=[Decimal("5.000")])
    barcode: str | None = Field(default=None, max_length=100, examples=[None])
    is_active: bool | None = Field(default=None, examples=[True])


class ProductResponse(BaseModel):
    id: int = Field(..., examples=[5])
    name: str = Field(..., examples=["cooking oil"])
    shop_id: int = Field(..., examples=[2])
    category_id: int | None = Field(default=None, examples=[1])
    purchase_price: Decimal = Field(..., examples=[Decimal("100.00")])
    selling_price: Decimal = Field(..., examples=[Decimal("120.00")])
    pack_size: Decimal = Field(..., examples=[Decimal("1.000")])
    unit: str = Field(..., examples=["litre"])
    stock_quantity: Decimal = Field(..., examples=[Decimal("20.000")])
    low_stock_threshold: Decimal = Field(..., examples=[Decimal("5.000")])
    barcode: str | None = Field(default=None, examples=[None])
    is_active: bool = Field(..., examples=[True])
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 5,
                "name": "cooking oil",
                "shop_id": 2,
                "category_id": 1,
                "pack_size": "1.000",
                "unit": "litre",
                "purchase_price": "100.00",
                "selling_price": "120.00",
                "stock_quantity": "20.000",
                "low_stock_threshold": "5.000",
                "barcode": None,
                "is_active": True,
                "created_at": "2026-10-04T12:00:00Z",
                "updated_at": "2026-10-04T12:00:00Z",
            }
        },
    )


class StockUpdate(BaseModel):
    stock_quantity: Decimal = Field(
        ...,
        ge=0,
        decimal_places=3,
        description="New stock quantity (must be non-negative)",
        examples=[Decimal("25.000")],
    )


class ProductStatusUpdate(BaseModel):
    is_active: bool = Field(
        ...,
        description="Active status of the product",
        examples=[True],
    )

