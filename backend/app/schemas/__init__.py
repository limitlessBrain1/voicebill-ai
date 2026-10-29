"""Pydantic v2 schemas package.

Data transfer schemas will be defined here (e.g., AuthSchema, ProductSchema, BillSchema).
"""
from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest, UserResponse
from app.schemas.billing_cart import (
    CartCreate,
    CartItemCreate,
    CartItemResponse,
    CartItemUpdate,
    CartResponse,
)
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate
from app.schemas.shop import ShopCreate, ShopResponse, ShopUpdate
from app.schemas.voice_product import (
    VoiceProductBatchCreateRequest,
    VoiceProductBatchCreateResponse,
    VoiceProductConfirmRequest,
    VoiceProductItemRequest,
    VoiceProductParseRequest,
    VoiceProductParseResponse,
)

__all__ = [
    "CartCreate",
    "CartItemCreate",
    "CartItemResponse",
    "CartItemUpdate",
    "CartResponse",
    "CategoryCreate",
    "CategoryResponse",
    "CategoryUpdate",
    "LoginRequest",
    "LoginResponse",
    "ProductCreate",
    "ProductResponse",
    "ProductUpdate",
    "RegisterRequest",
    "ShopCreate",
    "ShopResponse",
    "ShopUpdate",
    "UserResponse",
    "VoiceProductBatchCreateRequest",
    "VoiceProductBatchCreateResponse",
    "VoiceProductConfirmRequest",
    "VoiceProductItemRequest",
    "VoiceProductParseRequest",
    "VoiceProductParseResponse",
]



