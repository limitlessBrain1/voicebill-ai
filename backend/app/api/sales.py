from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.sale import (
    CheckoutRequest,
    SaleResponse,
    SalesListResponse,
)
from app.services.sale import (
    build_sale_response,
    get_sale_by_id_or_404,
    get_sale_by_receipt_or_404,
    list_sales_for_shop,
    process_cart_checkout,
)

router = APIRouter(
    tags=["Sales & Checkout"],
)


def parse_date_boundary(val: Optional[str], is_end: bool = False) -> Optional[datetime]:
    """Parse date or datetime string into timezone-aware datetime."""
    if not val or not val.strip():
        return None
    clean = val.strip()
    try:
        if len(clean) == 10 and clean.count("-") == 2:
            d = datetime.strptime(clean, "%Y-%m-%d")
            if is_end:
                return d.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
            return d.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
        dt = datetime.fromisoformat(clean.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None



# -----------------------------------------------------------------------------
# CART CHECKOUT (POST /api/billing/cart/{cart_id}/checkout)
# -----------------------------------------------------------------------------

@router.post(
    "/billing/cart/{cart_id}/checkout",
    response_model=SaleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Checkout draft billing cart and finalize sale",
)
def checkout_cart(
    cart_id: int,
    checkout_data: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Finalize a draft billing cart into a completed Sale:
    - Verifies cart belongs to authenticated user's shop
    - Re-fetches authoritative product prices and validates available stock
    - Deducts inventory permanently in a single atomic transaction
    - Records payment and marks cart completed
    - Generates unique receipt number and returns receipt details
    - Rejects duplicate checkout attempts
    """
    return process_cart_checkout(
        db=db,
        cart_id=cart_id,
        checkout_data=checkout_data,
        shop_id=current_user.shop_id,
        user_id=current_user.id,
    )


# -----------------------------------------------------------------------------
# GET SALE BY ID (GET /api/sales/{sale_id})
# -----------------------------------------------------------------------------

@router.get(
    "/sales/{sale_id}",
    response_model=SaleResponse,
    status_code=status.HTTP_200_OK,
    summary="Get sale details and receipt by ID",
)
def get_sale(
    sale_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve historical sale receipt by sale ID.
    Strictly isolated to authenticated user's shop.
    """
    sale = get_sale_by_id_or_404(
        db=db,
        sale_id=sale_id,
        shop_id=current_user.shop_id,
    )
    return build_sale_response(sale)


# -----------------------------------------------------------------------------
# GET SALE BY RECEIPT NUMBER (GET /api/sales/receipt/{receipt_number})
# -----------------------------------------------------------------------------

@router.get(
    "/sales/receipt/{receipt_number}",
    response_model=SaleResponse,
    status_code=status.HTTP_200_OK,
    summary="Get sale details and receipt by receipt number",
)
def get_sale_by_receipt(
    receipt_number: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve historical sale receipt by unique receipt number.
    Strictly isolated to authenticated user's shop.
    """
    sale = get_sale_by_receipt_or_404(
        db=db,
        receipt_number=receipt_number,
        shop_id=current_user.shop_id,
    )
    return build_sale_response(sale)


# -----------------------------------------------------------------------------
# LIST SALES FOR SHOP (GET /api/sales)
# -----------------------------------------------------------------------------

@router.get(
    "/sales",
    response_model=SalesListResponse,
    status_code=status.HTTP_200_OK,
    summary="List sales history for current shop with search and filters",
)
def list_sales(
    receipt_number: Optional[str] = Query(None, description="Search by receipt number"),
    payment_method: Optional[str] = Query(None, description="Filter by payment method (cash, upi)"),
    payment_status: Optional[str] = Query(None, description="Filter by payment status (completed, etc.)"),
    start_date: Optional[str] = Query(None, description="Filter sales on or after start date (YYYY-MM-DD or ISO)"),
    end_date: Optional[str] = Query(None, description="Filter sales on or before end date (YYYY-MM-DD or ISO)"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List historical sales for the authenticated user's shop with search, filtering, and pagination.
    Strictly isolated to current_user.shop_id.
    """
    parsed_start = parse_date_boundary(start_date, is_end=False)
    parsed_end = parse_date_boundary(end_date, is_end=True)

    sales, total_count = list_sales_for_shop(
        db=db,
        shop_id=current_user.shop_id,
        receipt_number=receipt_number,
        payment_method=payment_method,
        payment_status=payment_status,
        start_date=parsed_start,
        end_date=parsed_end,
        limit=limit,
        offset=offset,
    )
    return SalesListResponse(
        sales=[build_sale_response(s) for s in sales],
        total_count=total_count,
        limit=limit,
        offset=offset,
    )

