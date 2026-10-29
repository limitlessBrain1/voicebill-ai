from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import secrets
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.billing_cart import BillingCart
from app.models.product import Product
from app.models.sale import Payment, Sale, SaleItem
from app.models.shop import Shop
from app.schemas.sale import (
    CheckoutRequest,
    PaymentResponse,
    SaleItemResponse,
    SaleResponse,
    SaleShopResponse,
)


def generate_receipt_number(shop_id: int) -> str:
    """Generate a clean, professional, human-readable unique receipt number."""
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    rand_suffix = secrets.token_hex(2).upper()
    return f"REC-{shop_id}-{now_str}-{rand_suffix}"


def build_sale_response(sale: Sale, shop: Optional[Shop] = None) -> SaleResponse:
    """Convert SQLAlchemy Sale model to Pydantic SaleResponse with snapshots."""
    sale_shop = shop or sale.shop
    shop_data = None
    if sale_shop:
        shop_data = SaleShopResponse(
            id=sale_shop.id,
            name=sale_shop.name,
            owner_name=sale_shop.owner_name,
            phone=sale_shop.phone,
            address=sale_shop.address,
            city=sale_shop.city,
            state=sale_shop.state,
            pincode=sale_shop.pincode,
            gst_number=sale_shop.gst_number,
        )

    items_data = [
        SaleItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product_name,
            unit=item.unit,
            unit_price=item.unit_price,
            quantity=item.quantity,
            line_total=item.line_total,
            created_at=item.created_at,
        )
        for item in sale.items
    ]

    payments_data = [
        PaymentResponse(
            id=pay.id,
            sale_id=pay.sale_id,
            shop_id=pay.shop_id,
            payment_method=pay.payment_method,
            amount=pay.amount,
            status=pay.status,
            reference=pay.reference,
            created_at=pay.created_at,
        )
        for pay in sale.payments
    ]

    return SaleResponse(
        id=sale.id,
        receipt_number=sale.receipt_number,
        shop_id=sale.shop_id,
        user_id=sale.user_id,
        cart_id=sale.cart_id,
        subtotal=sale.subtotal,
        discount_amount=sale.discount_amount,
        tax_amount=sale.tax_amount,
        total_amount=sale.total_amount,
        payment_method=sale.payment_method,
        payment_status=sale.payment_status,
        amount_received=sale.amount_received,
        change_due=sale.change_due,
        payment_reference=sale.payment_reference,
        notes=sale.notes,
        created_at=sale.created_at,
        updated_at=sale.updated_at,
        items=items_data,
        payments=payments_data,
        shop=shop_data,
    )


def process_cart_checkout(
    db: Session,
    cart_id: int,
    checkout_data: CheckoutRequest,
    shop_id: int,
    user_id: int,
) -> SaleResponse:
    """
    Execute atomic checkout of a billing cart into a completed Sale.

    Validations & Invariants:
    1. Cart exists, belongs to shop_id, and is in 'draft' status.
    2. Cart is not empty.
    3. Duplicate checkout prevention: row lock with with_for_update, check if already completed.
    4. Authoritative DB product validation: active status, shop ownership, stock availability.
    5. Exact Decimal precision for line totals, subtotal, discount, tax, and payable total.
    6. Payment amount validation for Cash (received >= total) and UPI.
    7. Inventory deduction executed strictly on successful sale.
    8. Single atomic transaction: commits on success, rolls back on error.
    """
    try:
        # 1. Fetch cart with row lock to serialize concurrent checkout attempts
        cart = (
            db.query(BillingCart)
            .filter(BillingCart.id == cart_id)
            .with_for_update()
            .first()
        )

        if not cart:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Billing cart #{cart_id} not found.",
            )

        if cart.shop_id != shop_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Billing cart #{cart_id} does not belong to your shop.",
            )

        # 2. Check cart status & duplicate checkouts
        if cart.status == "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cart has already been checked out and completed.",
            )

        if cart.status != "draft":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cart cannot be checked out (current status: '{cart.status}').",
            )

        # Check if sale already created for this cart
        existing_sale = db.query(Sale).filter(Sale.cart_id == cart.id).first()
        if existing_sale:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A completed sale already exists for this cart.",
            )

        # 3. Validate cart has items
        if not cart.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot checkout an empty billing cart. Add products first.",
            )

        # Fetch shop details for receipt
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if not shop:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Shop #{shop_id} not found.",
            )

        # 4. Authoritative product validation & stock checks (with row lock on products)
        prepared_items: list[dict] = []
        subtotal = Decimal("0.00")

        for cart_item in cart.items:
            # Re-fetch authoritative product from DB with row lock
            product = (
                db.query(Product)
                .filter(Product.id == cart_item.product_id)
                .with_for_update()
                .first()
            )

            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product #{cart_item.product_id} no longer exists in catalog.",
                )

            if product.shop_id != shop_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product '{product.name}' belongs to a different shop.",
                )

            if not product.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product '{product.name}' is inactive and cannot be sold.",
                )

            item_qty = Decimal(str(cart_item.quantity))
            if item_qty <= Decimal("0"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid quantity ({item_qty}) for product '{product.name}'.",
                )

            # Strict stock validation against actual database inventory
            if product.stock_quantity < item_qty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient stock for '{product.name}'. "
                        f"Available: {product.stock_quantity} {product.unit}, Requested: {item_qty} {product.unit}."
                    ),
                )

            # Snapshot authoritative selling price from Product model
            unit_price = Decimal(str(product.selling_price))
            line_total = (unit_price * item_qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            subtotal += line_total

            prepared_items.append({
                "product": product,
                "product_id": product.id,
                "product_name": product.name,
                "unit": product.unit,
                "unit_price": unit_price,
                "quantity": item_qty,
                "line_total": line_total,
            })

        # 5. Financial calculations with Decimal
        discount_amount = Decimal(str(cart.discount_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        tax_amount = Decimal(str(cart.tax_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_amount = (subtotal - discount_amount + tax_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if total_amount < Decimal("0.00"):
            total_amount = Decimal("0.00")

        # 6. Payment validation
        payment_method = checkout_data.payment_method
        amount_received: Optional[Decimal] = None
        change_due: Optional[Decimal] = Decimal("0.00")

        if payment_method == "cash":
            if checkout_data.amount_received is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="amount_received is required for cash payments.",
                )
            amount_received = Decimal(str(checkout_data.amount_received)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if amount_received < total_amount:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient cash received (₹{amount_received}). "
                        f"Payable total amount is ₹{total_amount}."
                    ),
                )
            change_due = (amount_received - total_amount).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        elif payment_method == "upi":
            amount_received = total_amount
            change_due = Decimal("0.00")
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported payment method: '{payment_method}'. Supported methods: cash, upi.",
            )

        # 7. Create Sale record
        receipt_number = generate_receipt_number(shop_id=shop_id)
        sale = Sale(
            receipt_number=receipt_number,
            shop_id=shop_id,
            user_id=user_id,
            cart_id=cart.id,
            subtotal=subtotal,
            discount_amount=discount_amount,
            tax_amount=tax_amount,
            total_amount=total_amount,
            payment_method=payment_method,
            payment_status="completed",
            amount_received=amount_received,
            change_due=change_due,
            payment_reference=checkout_data.payment_reference,
            notes=checkout_data.notes,
        )
        db.add(sale)
        db.flush()  # Populates sale.id

        # 8. Create SaleItem records & Deduct Inventory
        for item_data in prepared_items:
            product = item_data["product"]
            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=item_data["product_id"],
                product_name=item_data["product_name"],
                unit=item_data["unit"],
                unit_price=item_data["unit_price"],
                quantity=item_data["quantity"],
                line_total=item_data["line_total"],
            )
            db.add(sale_item)

            # Deduct inventory permanently on completed checkout
            product.stock_quantity = (
                Decimal(str(product.stock_quantity)) - item_data["quantity"]
            ).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)

        # 9. Record Payment
        payment_record = Payment(
            sale_id=sale.id,
            shop_id=shop_id,
            payment_method=payment_method,
            amount=total_amount,
            status="completed",
            reference=checkout_data.payment_reference,
        )
        db.add(payment_record)

        # 10. Mark Cart completed to prevent re-checkout
        cart.status = "completed"

        # 11. Atomic Commit
        db.commit()

        # Refresh sale with items and relations
        db.refresh(sale)
        return build_sale_response(sale, shop=shop)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during checkout: {str(exc)}",
        ) from exc


def get_sale_by_id_or_404(
    db: Session,
    sale_id: int,
    shop_id: int,
) -> Sale:
    """Retrieve sale by ID scoped strictly to shop_id."""
    sale = (
        db.query(Sale)
        .filter(Sale.id == sale_id, Sale.shop_id == shop_id)
        .first()
    )
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sale #{sale_id} not found in your shop.",
        )
    return sale


def get_sale_by_receipt_or_404(
    db: Session,
    receipt_number: str,
    shop_id: int,
) -> Sale:
    """Retrieve sale by receipt number scoped strictly to shop_id."""
    sale = (
        db.query(Sale)
        .filter(Sale.receipt_number == receipt_number, Sale.shop_id == shop_id)
        .first()
    )
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Receipt '{receipt_number}' not found in your shop.",
        )
    return sale


def list_sales_for_shop(
    db: Session,
    shop_id: int,
    receipt_number: Optional[str] = None,
    payment_method: Optional[str] = None,
    payment_status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Sale], int]:
    """
    List sales for the given shop with search, filtering, and pagination.
    Supports:
    - receipt_number: Case-insensitive substring match
    - payment_method: exact match (cash, upi)
    - payment_status: exact match (completed, etc.)
    - start_date / end_date: date boundary filtering
    - limit / offset: pagination
    """
    query = db.query(Sale).filter(Sale.shop_id == shop_id)

    if receipt_number and receipt_number.strip():
        clean_rn = receipt_number.strip()
        query = query.filter(Sale.receipt_number.ilike(f"%{clean_rn}%"))

    if payment_method and payment_method.strip() and payment_method.strip().lower() != "all":
        query = query.filter(Sale.payment_method == payment_method.strip().lower())

    if payment_status and payment_status.strip() and payment_status.strip().lower() != "all":
        query = query.filter(Sale.payment_status == payment_status.strip().lower())

    if start_date:
        query = query.filter(Sale.created_at >= start_date)

    if end_date:
        query = query.filter(Sale.created_at <= end_date)

    total_count = query.count()
    sales = (
        query.order_by(Sale.created_at.desc(), Sale.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return sales, total_count

