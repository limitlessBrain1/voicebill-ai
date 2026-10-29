from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.billing_cart import (
    CartCreate,
    CartItemCreate,
    CartItemUpdate,
    CartResponse,
)
from app.schemas.voice_billing import (
    VoiceBillingParseRequest,
    VoiceBillingParseResponse,
)
from app.services.billing_cart import (
    add_item_to_cart,
    build_cart_response,
    clear_cart,
    create_cart,
    get_cart_or_404,
    get_or_create_user_cart,
    remove_cart_item,
    update_cart_item_quantity,
)
from app.services.voice_billing_parser import parse_voice_billing_command

router = APIRouter(
    prefix="/billing",
    tags=["Billing"],
)


# -----------------------------------------------------------------------------
# CREATE CART
# -----------------------------------------------------------------------------

@router.post(
    "/cart",
    response_model=CartResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_billing_cart(
    cart_data: CartCreate | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new draft billing cart scoped to the authenticated user's shop and user.
    shop_id is strictly derived from current_user.shop_id.
    """
    cart = create_cart(
        db=db,
        shop_id=current_user.shop_id,
        user_id=current_user.id,
    )
    return build_cart_response(cart)


# -----------------------------------------------------------------------------
# GET ACTIVE / CURRENT CART
# -----------------------------------------------------------------------------

@router.get(
    "/cart/active/current",
    response_model=CartResponse,
    status_code=status.HTTP_200_OK,
    summary="Get or create current open/draft cart for authenticated user",
)
def get_or_create_active_cart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve the current open/draft cart for the authenticated user and shop.
    Creates a new draft cart if none is currently active.
    """
    cart = get_or_create_user_cart(
        db=db,
        shop_id=current_user.shop_id,
        user_id=current_user.id,
    )
    return build_cart_response(cart)


# -----------------------------------------------------------------------------
# GET CART BY ID
# -----------------------------------------------------------------------------

@router.get(
    "/cart/{cart_id}",
    response_model=CartResponse,
    status_code=status.HTTP_200_OK,
)
def get_billing_cart(
    cart_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve cart information, items, subtotal, discount, tax, and total.
    Shop isolation: Only accessible by users belonging to the cart's shop.
    User isolation: Non-owners can only view their own carts.
    """
    cart = get_cart_or_404(
        db=db,
        cart_id=cart_id,
        shop_id=current_user.shop_id,
        user_id=current_user.id if current_user.role != "owner" else None,
    )
    return build_cart_response(cart)


# -----------------------------------------------------------------------------
# ADD ITEM TO CART
# -----------------------------------------------------------------------------

@router.post(
    "/cart/{cart_id}/items",
    response_model=CartResponse,
    status_code=status.HTTP_200_OK,
)
def add_billing_cart_item(
    cart_id: int,
    item_data: CartItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Add a product to the draft billing cart.
    - Validates cart and product belong to current_user.shop_id.
    - Validates product is active.
    - Validates available stock.
    - Snapshots unit_price from product selling_price.
    - Merges quantity if product already exists in the cart.
    - Does NOT deduct stock or create a permanent sale.
    """
    cart = get_cart_or_404(
        db=db,
        cart_id=cart_id,
        shop_id=current_user.shop_id,
        user_id=current_user.id if current_user.role != "owner" else None,
    )
    updated_cart = add_item_to_cart(
        db=db,
        cart=cart,
        product_id=item_data.product_id,
        quantity=item_data.quantity,
        shop_id=current_user.shop_id,
    )
    return build_cart_response(updated_cart)


# -----------------------------------------------------------------------------
# UPDATE CART ITEM QUANTITY
# -----------------------------------------------------------------------------

@router.put(
    "/cart/{cart_id}/items/{item_id}",
    response_model=CartResponse,
    status_code=status.HTTP_200_OK,
)
def update_billing_cart_item(
    cart_id: int,
    item_id: int,
    item_data: CartItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the quantity of an item in the draft billing cart.
    Validates available stock and recalculates line_total and cart totals.
    """
    cart = get_cart_or_404(
        db=db,
        cart_id=cart_id,
        shop_id=current_user.shop_id,
        user_id=current_user.id if current_user.role != "owner" else None,
    )
    updated_cart = update_cart_item_quantity(
        db=db,
        cart=cart,
        item_id=item_id,
        quantity=item_data.quantity,
    )
    return build_cart_response(updated_cart)


# -----------------------------------------------------------------------------
# REMOVE CART ITEM
# -----------------------------------------------------------------------------

@router.delete(
    "/cart/{cart_id}/items/{item_id}",
    response_model=CartResponse,
    status_code=status.HTTP_200_OK,
)
def delete_billing_cart_item(
    cart_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Remove an item from the draft billing cart.
    Recalculates cart totals after deletion.
    """
    cart = get_cart_or_404(
        db=db,
        cart_id=cart_id,
        shop_id=current_user.shop_id,
        user_id=current_user.id if current_user.role != "owner" else None,
    )
    updated_cart = remove_cart_item(
        db=db,
        cart=cart,
        item_id=item_id,
    )
    return build_cart_response(updated_cart)


# -----------------------------------------------------------------------------
# CLEAR CART (All Items)
# -----------------------------------------------------------------------------

@router.delete(
    "/cart/{cart_id}/clear",
    response_model=CartResponse,
    status_code=status.HTTP_200_OK,
    summary="Clear all items from draft cart",
)
def clear_billing_cart(
    cart_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Remove all items from the draft billing cart and reset subtotal to 0.
    """
    cart = get_cart_or_404(
        db=db,
        cart_id=cart_id,
        shop_id=current_user.shop_id,
        user_id=current_user.id if current_user.role != "owner" else None,
    )
    cleared_cart = clear_cart(db=db, cart=cart)
    return build_cart_response(cleared_cart)


@router.delete(
    "/cart/{cart_id}/items",
    response_model=CartResponse,
    status_code=status.HTTP_200_OK,
    summary="Clear all items from draft cart (REST alias)",
)
def clear_billing_cart_alias(
    cart_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    REST alias to remove all items from the draft cart.
    """
    return clear_billing_cart(cart_id=cart_id, current_user=current_user, db=db)


# -----------------------------------------------------------------------------
# VOICE BILLING PARSER & PRODUCT MATCHER
# -----------------------------------------------------------------------------

@router.post(
    "/voice/parse",
    response_model=VoiceBillingParseResponse,
    status_code=status.HTTP_200_OK,
    summary="Parse voice billing command and match shop products",
)
def parse_voice_billing(
    payload: VoiceBillingParseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Parse a spoken or typed billing command (e.g. 'Add sugar 2 kg').
    Extracts product name, requested quantity, and measurement unit.
    Searches the authenticated user's shop catalog for active products.
    Converts units (e.g. grams -> kg) and returns exact or multiple matches.
    Does NOT modify the database or cart.
    """
    return parse_voice_billing_command(
        command=payload.command,
        shop_id=current_user.shop_id,
        db=db,
    )


