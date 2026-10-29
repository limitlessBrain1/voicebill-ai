from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_owner
from app.database.session import get_db
from app.models.user import User
from app.schemas.product import ProductResponse
from app.schemas.voice_product import (
    VoiceProductBatchCreateRequest,
    VoiceProductBatchCreateResponse,
    VoiceProductConfirmRequest,
    VoiceProductParseRequest,
    VoiceProductParseResponse,
)
from app.services.product_service import (
    create_product,
    create_products_batch,
    resolve_category_by_name,
)
from app.services.voice_product_parser import (
    VoiceProductParseError,
    parse_voice_product_command,
)


router = APIRouter(
    prefix="/voice/products",
    tags=["Voice Products"],
)


@router.post(
    "/parse",
    response_model=VoiceProductParseResponse,
    status_code=status.HTTP_200_OK,
    summary="Parse voice product command transcript",
    description="Parses a voice command transcript into structured product data for review/confirmation. Strictly read-only; does NOT write to the database.",
)
def parse_voice_product(
    payload: VoiceProductParseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VoiceProductParseResponse:
    """
    Parse a voice command string into structured product attributes.
    
    - Authentication required.
    - Scoped to authenticated user's shop (current_user.shop_id).
    - shop_id is never accepted from the request body.
    - Pure parser: no database inserts or modifications are performed.
    """
    try:
        parsed_product = parse_voice_product_command(
            command=payload.command,
            shop_id=current_user.shop_id,
            db=db,
        )
        return parsed_product
    except VoiceProductParseError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        )


@router.post(
    "/create-batch",
    response_model=VoiceProductBatchCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Batch create products from reviewed pending list",
    description="Atomically validates and creates multiple products reviewed and confirmed by the store owner in a single database transaction. Multi-shop data isolation enforced.",
)
def create_products_batch_endpoint(
    payload: VoiceProductBatchCreateRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> VoiceProductBatchCreateResponse:
    """
    Batch create products after owner reviews pending list and clicks 'Save All'.
    
    - Requires authenticated store owner (role == 'owner'). Returns 403 Forbidden otherwise.
    - Scoped strictly to current_user.shop_id.
    - Atomic transaction: Validates all items first. If any product is invalid, nothing is created.
    - If all items are valid, creates and commits all products together in a single transaction.
    - Returns count and details of created products.
    """
    created_products = create_products_batch(
        db=db,
        shop_id=current_user.shop_id,
        products_data=payload.products,
    )

    return VoiceProductBatchCreateResponse(
        created_count=len(created_products),
        products=created_products,
    )


@router.post(
    "/confirm",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    deprecated=True,
    summary="[DEPRECATED] Confirm single product from voice preview",
    description="Deprecated in favor of POST /api/voice/products/create-batch. Retained for backward compatibility.",
)
def confirm_voice_product(
    payload: VoiceProductConfirmRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> ProductResponse:
    """
    Deprecated single product confirmation endpoint.
    Please use POST /api/voice/products/create-batch for the Save All pending workflow.
    """
    category_id = resolve_category_by_name(
        db=db,
        shop_id=current_user.shop_id,
        category_name=payload.category_name,
    )

    low_stock = payload.low_stock_threshold if payload.low_stock_threshold is not None else Decimal("0")
    product = create_product(
        db=db,
        shop_id=current_user.shop_id,
        name=payload.name,
        purchase_price=payload.purchase_price,
        selling_price=payload.selling_price,
        pack_size=payload.pack_size,
        unit=payload.unit,
        stock_quantity=payload.stock_quantity,
        low_stock_threshold=low_stock,
        category_id=category_id,
        barcode=payload.barcode,
        is_active=True,
    )

    return product


