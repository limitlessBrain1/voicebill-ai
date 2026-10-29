from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator



class VoiceProductParseRequest(BaseModel):
    """Voice product command parsing request schema."""

    command: str = Field(
        ...,
        min_length=1,
        description="Spoken voice command transcript to parse into structured product information.",
        examples=["Add sugar, 1 kg, purchase price 40, selling price 45, stock 20 kg."],
    )


class VoiceProductParseResponse(BaseModel):
    """Structured product information extracted from a voice command."""

    name: str = Field(..., description="Product name", examples=["cooking oil"])
    pack_size: Decimal = Field(
        default=Decimal("1"),
        gt=0,
        decimal_places=3,
        description="Package size / quantity per pack",
        examples=[Decimal("1")],
    )
    unit: str = Field(
        ...,
        description="Unit of measurement (e.g. kg, g, litre, pcs, packet)",
        examples=["litre"],
    )
    purchase_price: Decimal = Field(
        ...,
        ge=0,
        decimal_places=2,
        description="Purchase price (cost per unit)",
        examples=[Decimal("100.00")],
    )
    selling_price: Decimal = Field(
        ...,
        ge=0,
        decimal_places=2,
        description="Selling price (retail price per unit)",
        examples=[Decimal("120.00")],
    )
    stock_quantity: Decimal = Field(
        ...,
        ge=0,
        decimal_places=3,
        description="Initial stock quantity",
        examples=[Decimal("20.000")],
    )
    low_stock_threshold: Decimal | None = Field(
        default=None,
        ge=0,
        decimal_places=3,
        description="Optional minimum stock alert threshold",
        examples=[Decimal("5.000")],
    )
    category_name: str | None = Field(
        default=None,
        description="Optional category name",
        examples=["Grocery"],
    )
    barcode: str | None = Field(
        default=None,
        description="Optional barcode or SKU string",
        examples=[None],
    )

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "name": "cooking oil",
                "pack_size": "1",
                "unit": "litre",
                "purchase_price": "100.00",
                "selling_price": "120.00",
                "stock_quantity": "20.000",
                "low_stock_threshold": "5.000",
                "category_name": "Grocery",
                "barcode": None,
            }
        },
    )


from app.schemas.product import ProductResponse


class VoiceProductItemRequest(BaseModel):
    """Structured product item data for pending list review and batch creation."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=150,
        description="Product name",
        examples=["cooking oil"],
    )
    pack_size: Decimal = Field(
        default=Decimal("1"),
        gt=0,
        decimal_places=3,
        description="Package size / quantity per pack",
        examples=[Decimal("1")],
    )
    unit: str = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Unit of measurement (e.g. kg, g, litre, pcs, packet)",
        examples=["litre"],
    )
    purchase_price: Decimal = Field(
        ...,
        ge=0,
        decimal_places=2,
        description="Purchase price / cost per unit",
        examples=[Decimal("100.00")],
    )
    selling_price: Decimal = Field(
        ...,
        ge=0,
        decimal_places=2,
        description="Selling price / retail price per unit",
        examples=[Decimal("120.00")],
    )
    stock_quantity: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        decimal_places=3,
        description="Initial stock quantity",
        examples=[Decimal("20.000")],
    )
    low_stock_threshold: Decimal | None = Field(
        default=None,
        ge=0,
        decimal_places=3,
        description="Optional minimum stock alert threshold",
        examples=[Decimal("5.000")],
    )
    category_name: str | None = Field(
        default=None,
        max_length=100,
        description="Optional category name to resolve within current user's shop",
        examples=["Grocery"],
    )
    barcode: str | None = Field(
        default=None,
        max_length=100,
        description="Optional barcode or SKU string",
        examples=[None],
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Product name cannot be empty.")
        return cleaned

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Unit cannot be empty.")
        return cleaned

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "name": "cooking oil",
                "pack_size": "1",
                "unit": "litre",
                "purchase_price": "100.00",
                "selling_price": "120.00",
                "stock_quantity": "20.000",
                "low_stock_threshold": "5.000",
                "category_name": "Grocery",
                "barcode": None,
            }
        },
    )


class VoiceProductConfirmRequest(VoiceProductItemRequest):
    """Legacy single product confirmation request (kept for backward compatibility)."""
    pass


class VoiceProductBatchCreateRequest(BaseModel):
    """Batch product creation request schema for the Save All voice flow."""

    products: list[VoiceProductItemRequest] = Field(
        ...,
        min_length=1,
        description="List of reviewed and confirmed products to create in a single atomic transaction.",
    )

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "products": [
                    {
                        "name": "Sugar",
                        "pack_size": "1.000",
                        "unit": "kg",
                        "purchase_price": "40.00",
                        "selling_price": "45.00",
                        "stock_quantity": "20.000",
                        "low_stock_threshold": "5.000",
                        "category_name": "Grocery",
                        "barcode": None,
                    },
                    {
                        "name": "Rice",
                        "pack_size": "5.000",
                        "unit": "kg",
                        "purchase_price": "50.00",
                        "selling_price": "60.00",
                        "stock_quantity": "30.000",
                        "low_stock_threshold": "5.000",
                        "category_name": "Grocery",
                        "barcode": None,
                    },
                ]
            }
        },
    )


class VoiceProductBatchCreateResponse(BaseModel):
    """Response containing the count and details of all atomically created products."""

    created_count: int = Field(
        ...,
        description="Number of products successfully created",
        examples=[2],
    )
    products: list[ProductResponse] = Field(
        ...,
        description="List of created products",
    )

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "created_count": 2,
                "products": [
                    {
                        "id": 10,
                        "name": "Sugar",
                        "shop_id": 2,
                        "category_id": 1,
                        "pack_size": "1.000",
                        "unit": "kg",
                        "purchase_price": "40.00",
                        "selling_price": "45.00",
                        "stock_quantity": "20.000",
                        "low_stock_threshold": "5.000",
                        "barcode": None,
                        "is_active": True,
                        "created_at": "2026-10-04T12:00:00Z",
                        "updated_at": "2026-10-04T12:00:00Z",
                    }
                ]
            }
        },
    )


