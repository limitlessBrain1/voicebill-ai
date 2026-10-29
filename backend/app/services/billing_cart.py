from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.billing_cart import BillingCart, BillingCartItem
from app.models.product import Product
from app.schemas.billing_cart import CartItemResponse, CartResponse


# -----------------------------------------------------------------------------
# Monetary and Quantity Quantization Helpers
# -----------------------------------------------------------------------------

def calculate_line_total(quantity: Decimal, unit_price: Decimal) -> Decimal:
    """Calculate line item total using Decimal: quantity * unit_price, rounded to 2 decimal places."""
    return (quantity * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_cart_totals(cart: BillingCart) -> dict[str, Decimal]:
    """
    Calculate cart subtotal, discount, tax, and final total.
    Ensures total is never negative and all calculations use Decimal.
    """
    subtotal = sum(
        (item.line_total for item in cart.items),
        Decimal("0.00")
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    discount_amount = (cart.discount_amount or Decimal("0.00")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    tax_amount = (cart.tax_amount or Decimal("0.00")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    raw_total = subtotal - discount_amount + tax_amount
    total = max(Decimal("0.00"), raw_total).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    return {
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "tax_amount": tax_amount,
        "total": total,
    }


def build_cart_response(cart: BillingCart) -> CartResponse:
    """Construct a full CartResponse schema with computed totals and snapshot item data."""
    totals = calculate_cart_totals(cart)
    return CartResponse(
        id=cart.id,
        shop_id=cart.shop_id,
        user_id=cart.user_id,
        status=cart.status,
        items=[CartItemResponse.model_validate(item) for item in cart.items],
        subtotal=totals["subtotal"],
        discount_amount=totals["discount_amount"],
        tax_amount=totals["tax_amount"],
        total=totals["total"],
        created_at=cart.created_at,
        updated_at=cart.updated_at,
    )


# -----------------------------------------------------------------------------
# Reusable Domain & Validation Operations
# -----------------------------------------------------------------------------

def get_cart_or_404(
    db: Session,
    cart_id: int,
    shop_id: int,
    user_id: int | None = None,
) -> BillingCart:
    """
    Retrieve a cart strictly verified by cart_id and current shop_id (and optionally user_id).
    Prevents cross-shop and cross-user cart access.
    """
    query = db.query(BillingCart).filter(
        BillingCart.id == cart_id,
        BillingCart.shop_id == shop_id,
    )
    if user_id is not None:
        query = query.filter(BillingCart.user_id == user_id)

    cart = query.first()

    if not cart:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart not found",
        )

    return cart


def check_cart_editable(cart: BillingCart) -> None:
    """Ensure cart is in 'draft' status before performing mutating actions."""
    if cart.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cart is not editable",
        )


def create_cart(db: Session, shop_id: int, user_id: int) -> BillingCart:
    """Create a new draft cart for a shop and user."""
    cart = BillingCart(
        shop_id=shop_id,
        user_id=user_id,
        status="draft",
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
    )
    db.add(cart)
    db.commit()
    db.refresh(cart)
    return cart


def get_or_create_user_cart(db: Session, shop_id: int, user_id: int) -> BillingCart:
    """
    Retrieve the current open/draft cart for the authenticated user and shop.
    If no draft cart exists, create a new one.
    """
    cart = (
        db.query(BillingCart)
        .filter(
            BillingCart.shop_id == shop_id,
            BillingCart.user_id == user_id,
            BillingCart.status == "draft",
        )
        .order_by(BillingCart.id.desc())
        .first()
    )
    if not cart:
        cart = create_cart(db=db, shop_id=shop_id, user_id=user_id)
    return cart


def add_item_to_cart(
    db: Session,
    cart: BillingCart,
    product_id: int,
    quantity: Decimal,
    shop_id: int,
) -> BillingCart:
    """
    Add a product to cart or increment quantity if duplicate.
    Validations:
    1. Cart must be editable ('draft').
    2. Quantity must be > 0.
    3. Product must exist and belong to the same shop.
    4. Product must be active.
    5. Available stock must be sufficient (does not deduct permanent stock).
    Snapshots selling_price and unit at time of addition.
    """
    check_cart_editable(cart)

    if quantity <= Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be greater than 0",
        )

    # Validate product within the user's shop
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.shop_id == shop_id,
    ).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    if not product.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product is inactive",
        )

    # Check for existing duplicate product in this cart
    existing_item = db.query(BillingCartItem).filter(
        BillingCartItem.cart_id == cart.id,
        BillingCartItem.product_id == product.id,
    ).first()

    if existing_item:
        # Merge duplicate product quantity
        new_quantity = (existing_item.quantity + quantity).quantize(Decimal("0.001"))
        if product.stock_quantity is not None and new_quantity > product.stock_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for '{product.name}'. Available: {product.stock_quantity} {product.unit}, Requested: {new_quantity} {product.unit}",
            )
        existing_item.quantity = new_quantity
        existing_item.line_total = calculate_line_total(new_quantity, existing_item.unit_price)
    else:
        if product.stock_quantity is not None and quantity > product.stock_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for '{product.name}'. Available: {product.stock_quantity} {product.unit}, Requested: {quantity} {product.unit}",
            )
        # Create new cart item with price and unit snapshots
        quantized_qty = quantity.quantize(Decimal("0.001"))
        unit_price = product.selling_price.quantize(Decimal("0.01"))
        new_item = BillingCartItem(
            cart_id=cart.id,
            product_id=product.id,
            quantity=quantized_qty,
            unit_price=unit_price,
            unit=product.unit.strip(),
            line_total=calculate_line_total(quantized_qty, unit_price),
        )
        db.add(new_item)

    db.commit()
    db.refresh(cart)
    return cart


def update_cart_item_quantity(
    db: Session,
    cart: BillingCart,
    item_id: int,
    quantity: Decimal,
) -> BillingCart:
    """
    Update the quantity of an existing item in the cart.
    Validates quantity > 0, checks available stock, and recalculates line_total.
    Does not allow editing product_id or unit_price.
    """
    check_cart_editable(cart)

    if quantity <= Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be greater than 0",
        )

    item = db.query(BillingCartItem).filter(
        BillingCartItem.id == item_id,
        BillingCartItem.cart_id == cart.id,
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart item not found",
        )

    if item.product and item.product.stock_quantity is not None and quantity > item.product.stock_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock for '{item.product.name}'. Available: {item.product.stock_quantity} {item.unit}, Requested: {quantity} {item.unit}",
        )

    item.quantity = quantity.quantize(Decimal("0.001"))
    item.line_total = calculate_line_total(item.quantity, item.unit_price)

    db.commit()
    db.refresh(cart)
    return cart


def remove_cart_item(
    db: Session,
    cart: BillingCart,
    item_id: int,
) -> BillingCart:
    """
    Remove an item from the cart.
    Validates cart is draft and item belongs to this cart.
    """
    check_cart_editable(cart)

    item = db.query(BillingCartItem).filter(
        BillingCartItem.id == item_id,
        BillingCartItem.cart_id == cart.id,
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart item not found",
        )

    db.delete(item)
    db.commit()
    db.refresh(cart)
    return cart


def clear_cart(
    db: Session,
    cart: BillingCart,
) -> BillingCart:
    """
    Clear all items from a draft cart and reset discount and tax.
    """
    check_cart_editable(cart)

    db.query(BillingCartItem).filter(
        BillingCartItem.cart_id == cart.id
    ).delete(synchronize_session=False)

    cart.discount_amount = Decimal("0.00")
    cart.tax_amount = Decimal("0.00")

    db.commit()
    db.refresh(cart)
    return cart

