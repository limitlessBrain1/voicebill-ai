from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class VoiceBillingParseRequest(BaseModel):
    command: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Speech-to-text transcript of billing command (e.g. 'Add sugar 2 kg')",
        examples=["Add sugar 2 kg"],
    )


class VoiceBillingMatchedProduct(BaseModel):
    id: int
    name: str
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    selling_price: Decimal
    pack_size: Decimal
    unit: str
    stock_quantity: Decimal
    low_stock_threshold: Decimal
    barcode: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class VoiceBillingParseResponse(BaseModel):
    command: str
    parsed_product_name: str
    parsed_quantity: Decimal
    parsed_unit: Optional[str] = None
    resolved_quantity: Decimal
    match_type: str  # "exact", "multiple", "none"
    matches: list[VoiceBillingMatchedProduct] = []
    message: str

    model_config = ConfigDict(from_attributes=True)
