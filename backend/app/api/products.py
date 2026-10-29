from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.session import get_db
from app.models.category import Category
from app.models.product import Product
from app.models.user import User
from app.schemas.product import (
    ProductCreate,
    ProductResponse,
    ProductStatusUpdate,
    ProductUpdate,
    StockUpdate,
)
from app.services.product_service import (
    create_product as create_product_service,
)
from app.services.voice_product_parser import SUPPORTED_UNITS_MAP


router = APIRouter(
    prefix="/products",
    tags=["Products"],
)


# ---------------------------------------------------------
# CREATE PRODUCT
# ---------------------------------------------------------

@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    product_data: ProductCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new product scoped to the authenticated user's shop.
    shop_id is strictly derived from current_user.shop_id.
    Uses the reusable product_service to ensure identical creation logic across APIs.
    """
    return create_product_service(
        db=db,
        shop_id=current_user.shop_id,
        name=product_data.name,
        purchase_price=product_data.purchase_price,
        selling_price=product_data.selling_price,
        pack_size=product_data.pack_size,
        unit=product_data.unit,
        stock_quantity=product_data.stock_quantity,
        low_stock_threshold=product_data.low_stock_threshold,
        category_id=product_data.category_id,
        barcode=product_data.barcode,
        is_active=True,
    )


# ---------------------------------------------------------
# GET ALL PRODUCTS
# ---------------------------------------------------------

@router.get(
    "",
    response_model=list[ProductResponse],
)
def get_products(
    search: str | None = Query(
        default=None,
        description="Filter products by name or barcode substring (case-insensitive).",
    ),
    is_active: bool | None = Query(
        default=None,
        description="Filter products by active status. By default returns all products for the shop.",
    ),
    category_id: int | None = Query(
        default=None,
        description="Filter products by category ID.",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve all products belonging to the authenticated user's shop.
    Never returns products from other shops.
    """
    query = db.query(Product).filter(
        Product.shop_id == current_user.shop_id
    )

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Product.name).like(term),
                func.lower(Product.barcode).like(term),
            )
        )

    if is_active is not None:
        query = query.filter(Product.is_active == is_active)

    if category_id is not None:
        query = query.filter(Product.category_id == category_id)

    products = query.order_by(Product.id.asc()).all()

    return products


# ---------------------------------------------------------
# GET SINGLE PRODUCT BY ID
# ---------------------------------------------------------

@router.get(
    "/{product_id}",
    response_model=ProductResponse,
)
def get_product(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve a single product by ID.
    Strictly verifies ownership (Product.shop_id == current_user.shop_id).
    Returns 404 if product does not exist or belongs to another shop.
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.shop_id == current_user.shop_id,
    ).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return product


# ---------------------------------------------------------
# UPDATE PRODUCT
# ---------------------------------------------------------

@router.put(
    "/{product_id}",
    response_model=ProductResponse,
)
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update a product belonging to the authenticated user's shop.
    Validates category ownership and barcode uniqueness within the shop.
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.shop_id == current_user.shop_id,
    ).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    update_data = product_data.model_dump(exclude_unset=True)

    # 1. Validate category if provided in update payload
    if "category_id" in update_data:
        new_category_id = update_data["category_id"]
        if new_category_id is not None:
            category = db.query(Category).filter(
                Category.id == new_category_id,
                Category.shop_id == current_user.shop_id,
            ).first()

            if not category:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Category not found",
                )

    # 2. Validate barcode uniqueness if provided in update payload
    if "barcode" in update_data:
        barcode_raw = update_data["barcode"]
        if barcode_raw is not None and barcode_raw.strip():
            barcode_clean = barcode_raw.strip()
            duplicate_barcode = db.query(Product).filter(
                Product.shop_id == current_user.shop_id,
                Product.barcode == barcode_clean,
                Product.id != product_id,
            ).first()

            if duplicate_barcode:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Barcode already exists",
                )
            update_data["barcode"] = barcode_clean
        else:
            update_data["barcode"] = None

    # Clean and validate string inputs
    if "name" in update_data:
        name_clean = update_data["name"].strip() if isinstance(update_data["name"], str) else ""
        if not name_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Product name cannot be empty",
            )
        update_data["name"] = name_clean

    if "unit" in update_data:
        unit_str = update_data["unit"].strip().lower() if isinstance(update_data["unit"], str) else ""
        if not unit_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unit cannot be empty",
            )
        if unit_str in SUPPORTED_UNITS_MAP:
            update_data["unit"] = SUPPORTED_UNITS_MAP[unit_str]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid unit '{update_data['unit']}'. Must be a recognized measurement or packaging unit.",
            )

    # Apply updates
    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)

    return product


# ---------------------------------------------------------
# UPDATE PRODUCT STOCK
# ---------------------------------------------------------

@router.patch(
    "/{product_id}/stock",
    response_model=ProductResponse,
    summary="Update product stock quantity",
)
def update_product_stock(
    product_id: int,
    stock_data: StockUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update stock quantity for a product belonging strictly to current_user.shop_id.
    Validates stock quantity is non-negative and preserves decimal precision.
    Returns 404 if product not found or belongs to another shop.
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.shop_id == current_user.shop_id,
    ).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    product.stock_quantity = stock_data.stock_quantity
    db.commit()
    db.refresh(product)

    return product


# ---------------------------------------------------------
# UPDATE PRODUCT ACTIVE STATUS
# ---------------------------------------------------------

@router.patch(
    "/{product_id}/status",
    response_model=ProductResponse,
    summary="Activate or deactivate a product",
)
def update_product_status(
    product_id: int,
    status_data: ProductStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Activate or deactivate a product belonging strictly to current_user.shop_id.
    Returns 404 if product not found or belongs to another shop.
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.shop_id == current_user.shop_id,
    ).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    product.is_active = status_data.is_active
    db.commit()
    db.refresh(product)

    return product


# ---------------------------------------------------------
# DELETE / DEACTIVATE PRODUCT
# ---------------------------------------------------------

@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_product(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Soft-delete a product by setting is_active = False.
    Preserves historical referential integrity for future invoices and billing records.
    Returns 404 if not found or if the product belongs to another shop.
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.shop_id == current_user.shop_id,
    ).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    # Soft deletion
    product.is_active = False
    db.commit()

    return None
