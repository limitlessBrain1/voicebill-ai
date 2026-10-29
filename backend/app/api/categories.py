from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.session import get_db
from app.models.category import Category
from app.models.user import User
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
)


router = APIRouter(
    prefix="/categories",
    tags=["Categories"],
)


# ---------------------------------------------------------
# CREATE CATEGORY
# ---------------------------------------------------------

@router.post(
    "",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check whether this shop already has the category
    existing_category = db.query(Category).filter(
        Category.name == category_data.name,
        Category.shop_id == current_user.shop_id,
    ).first()

    if existing_category:
        raise HTTPException(
            status_code=400,
            detail="Category already exists",
        )

    category = Category(
        name=category_data.name,
        shop_id=current_user.shop_id,
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    return category


# ---------------------------------------------------------
# GET ALL CATEGORIES
# ---------------------------------------------------------

@router.get(
    "",
    response_model=list[CategoryResponse],
)
def get_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    categories = db.query(Category).filter(
        Category.shop_id == current_user.shop_id
    ).all()

    return categories


# ---------------------------------------------------------
# GET CATEGORY BY ID
# ---------------------------------------------------------

@router.get(
    "/{category_id}",
    response_model=CategoryResponse,
)
def get_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.shop_id == current_user.shop_id,
    ).first()

    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category not found",
        )

    return category


# ---------------------------------------------------------
# UPDATE CATEGORY
# ---------------------------------------------------------

@router.put(
    "/{category_id}",
    response_model=CategoryResponse,
)
def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.shop_id == current_user.shop_id,
    ).first()

    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category not found",
        )

    # Check duplicate category name
    existing_category = db.query(Category).filter(
        Category.name == category_data.name,
        Category.shop_id == current_user.shop_id,
        Category.id != category_id,
    ).first()

    if existing_category:
        raise HTTPException(
            status_code=400,
            detail="Category already exists",
        )

    category.name = category_data.name

    db.commit()
    db.refresh(category)

    return category


# ---------------------------------------------------------
# DELETE CATEGORY
# ---------------------------------------------------------

@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.shop_id == current_user.shop_id,
    ).first()

    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category not found",
        )

    db.delete(category)
    db.commit()

    return None