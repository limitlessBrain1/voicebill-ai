"""Product domain service.

Contains reusable business logic and persistence operations for products,
shared across normal product management APIs and voice-driven confirmation flows.
"""
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Product
from app.services.voice_product_parser import SUPPORTED_UNITS_MAP


def resolve_category_by_name(
    db: Session,
    shop_id: int,
    category_name: Optional[str],
) -> Optional[int]:
    """
    Find category ID by case-insensitive name belonging strictly to shop_id.
    
    - If category_name is None or empty: returns None (category_id = None).
    - If category_name is provided: looks up category scoped to shop_id.
    - If category does not exist for this shop: raises HTTP 400 Bad Request.
    - Multi-shop isolation: never searches globally across other shops.
    """
    if category_name is None:
        return None

    cleaned_name = category_name.strip()
    if not cleaned_name:
        return None

    category = (
        db.query(Category)
        .filter(
            Category.shop_id == shop_id,
            func.lower(Category.name) == cleaned_name.lower(),
        )
        .first()
    )

    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category '{cleaned_name}' not found for this shop",
        )

    return category.id


def validate_barcode_uniqueness(
    db: Session,
    shop_id: int,
    barcode: Optional[str],
    exclude_product_id: Optional[int] = None,
) -> Optional[str]:
    """
    Validate that a barcode is unique within a specific shop.
    Returns cleaned barcode string or None.
    """
    if barcode is None or not barcode.strip():
        return None

    barcode_clean = barcode.strip()
    query = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.barcode == barcode_clean,
    )
    if exclude_product_id is not None:
        query = query.filter(Product.id != exclude_product_id)

    existing = query.first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Barcode already exists",
        )

    return barcode_clean


def create_product(
    db: Session,
    shop_id: int,
    name: str,
    purchase_price: Decimal,
    selling_price: Decimal,
    unit: str,
    pack_size: Decimal = Decimal("1"),
    stock_quantity: Decimal = Decimal("0"),
    low_stock_threshold: Decimal = Decimal("0"),
    category_id: Optional[int] = None,
    barcode: Optional[str] = None,
    is_active: bool = True,
) -> Product:
    """
    Create a new product scoped to the specified shop_id.
    
    Performs domain validations:
    - Non-empty product name
    - Non-negative prices and stock quantities
    - Strictly positive pack_size (> 0)
    - Valid measurement/packaging unit
    - Valid category ownership within shop_id
    - Barcode uniqueness within shop_id
    """
    # 1. Clean and validate product name
    if not name or not name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product name cannot be empty",
        )
    name_clean = name.strip()

    # 2. Validate prices and quantities
    if purchase_price < Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Purchase price cannot be negative",
        )

    if selling_price < Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selling price cannot be negative",
        )

    if pack_size <= Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pack size must be greater than zero",
        )

    if stock_quantity < Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stock quantity cannot be negative",
        )

    if low_stock_threshold < Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Low stock threshold cannot be negative",
        )

    # 3. Clean and validate unit
    if not unit or not unit.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unit cannot be empty",
        )
    unit_clean = unit.strip().lower()
    if unit_clean in SUPPORTED_UNITS_MAP:
        unit_final = SUPPORTED_UNITS_MAP[unit_clean]
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid unit '{unit}'. Must be a recognized measurement or packaging unit.",
        )

    # 4. Validate category existence and shop ownership if category_id provided
    if category_id is not None:
        category = (
            db.query(Category)
            .filter(
                Category.id == category_id,
                Category.shop_id == shop_id,
            )
            .first()
        )
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found",
            )

    # 5. Validate barcode uniqueness within shop
    barcode_clean = validate_barcode_uniqueness(db, shop_id, barcode)

    # 6. Instantiate and persist product
    product = Product(
        name=name_clean,
        shop_id=shop_id,
        category_id=category_id,
        purchase_price=purchase_price,
        selling_price=selling_price,
        pack_size=pack_size,
        unit=unit_final,
        stock_quantity=stock_quantity,
        low_stock_threshold=low_stock_threshold,
        barcode=barcode_clean,
        is_active=is_active,
    )

    db.add(product)
    db.commit()
    db.refresh(product)

    return product


def create_products_batch(
    db: Session,
    shop_id: int,
    products_data: list,
) -> list[Product]:
    """
    Atomically validate and create a batch of products scoped to shop_id.
    
    Transaction guarantee:
    - Phase 1: Validates EVERY product in the incoming batch first.
    - If ANY product fails validation (bad price, unknown category, invalid unit, duplicate barcode),
      raises an HTTPException and creates ZERO products.
    - Phase 2: Persists all products in a single database transaction.
    - If an unexpected error occurs during database operations, rolls back the transaction.
    """
    if not products_data:
        return []

    # Phase 1: Pre-validate every single product in the batch
    validated_items: list[dict] = []
    seen_barcodes_in_batch: set[str] = set()

    for idx, item in enumerate(products_data):
        item_name = getattr(item, "name", None) or (item.get("name") if isinstance(item, dict) else "")
        name_clean = item_name.strip() if item_name else ""
        if not name_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product #{idx + 1}: Product name cannot be empty.",
            )

        purchase_price = getattr(item, "purchase_price", None) or (item.get("purchase_price") if isinstance(item, dict) else Decimal("0"))
        if purchase_price < Decimal("0"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product '{name_clean}' (index {idx}): Purchase price cannot be negative ({purchase_price}).",
            )

        selling_price = getattr(item, "selling_price", None) or (item.get("selling_price") if isinstance(item, dict) else Decimal("0"))
        if selling_price < Decimal("0"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product '{name_clean}' (index {idx}): Selling price cannot be negative ({selling_price}).",
            )

        pack_size = getattr(item, "pack_size", None) or (item.get("pack_size") if isinstance(item, dict) else Decimal("1"))
        if pack_size <= Decimal("0"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product '{name_clean}' (index {idx}): Pack size must be greater than zero ({pack_size}).",
            )

        stock_quantity = getattr(item, "stock_quantity", None) or (item.get("stock_quantity") if isinstance(item, dict) else Decimal("0"))
        if stock_quantity < Decimal("0"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product '{name_clean}' (index {idx}): Stock quantity cannot be negative ({stock_quantity}).",
            )

        low_stock_raw = getattr(item, "low_stock_threshold", None) or (item.get("low_stock_threshold") if isinstance(item, dict) else None)
        low_stock = low_stock_raw if low_stock_raw is not None else Decimal("0")
        if low_stock < Decimal("0"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product '{name_clean}' (index {idx}): Low stock threshold cannot be negative ({low_stock}).",
            )

        unit_val = getattr(item, "unit", None) or (item.get("unit") if isinstance(item, dict) else "")
        if not unit_val or not unit_val.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product '{name_clean}' (index {idx}): Unit cannot be empty.",
            )
        unit_clean = unit_val.strip().lower()
        if unit_clean in SUPPORTED_UNITS_MAP:
            unit_final = SUPPORTED_UNITS_MAP[unit_clean]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product '{name_clean}' (index {idx}): Invalid unit '{unit_val}'. Must be a recognized measurement or packaging unit.",
            )

        category_name = getattr(item, "category_name", None) or (item.get("category_name") if isinstance(item, dict) else None)
        category_id = resolve_category_by_name(
            db=db,
            shop_id=shop_id,
            category_name=category_name,
        )

        barcode_raw = getattr(item, "barcode", None) or (item.get("barcode") if isinstance(item, dict) else None)
        barcode_clean: Optional[str] = None
        if barcode_raw is not None and str(barcode_raw).strip():
            barcode_clean = str(barcode_raw).strip()
            if barcode_clean in seen_barcodes_in_batch:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Duplicate barcode '{barcode_clean}' found within the batch.",
                )
            seen_barcodes_in_batch.add(barcode_clean)

            existing_in_shop = (
                db.query(Product)
                .filter(
                    Product.shop_id == shop_id,
                    Product.barcode == barcode_clean,
                )
                .first()
            )
            if existing_in_shop:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Barcode '{barcode_clean}' already exists for another product in this shop.",
                )

        validated_items.append({
            "name": name_clean,
            "purchase_price": purchase_price,
            "selling_price": selling_price,
            "pack_size": pack_size,
            "unit": unit_final,
            "stock_quantity": stock_quantity,
            "low_stock_threshold": low_stock,
            "category_id": category_id,
            "barcode": barcode_clean,
            "is_active": True,
        })

    # Phase 2: Atomic Creation within single transaction
    created_products: list[Product] = []
    try:
        for val in validated_items:
            product = Product(
                name=val["name"],
                shop_id=shop_id,
                category_id=val["category_id"],
                purchase_price=val["purchase_price"],
                selling_price=val["selling_price"],
                pack_size=val["pack_size"],
                unit=val["unit"],
                stock_quantity=val["stock_quantity"],
                low_stock_threshold=val["low_stock_threshold"],
                barcode=val["barcode"],
                is_active=val["is_active"],
            )
            db.add(product)
            created_products.append(product)

        db.commit()

        for p in created_products:
            db.refresh(p)

        return created_products
    except Exception as exc:
        db.rollback()
        raise exc

