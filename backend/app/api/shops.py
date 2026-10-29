from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.shop import Shop
from app.schemas.shop import ShopCreate, ShopUpdate, ShopResponse


router = APIRouter(
    prefix="/shops",
    tags=["Shops"],
)


# --------------------------------------------------
# CREATE SHOP
# --------------------------------------------------

@router.post(
    "",
    response_model=ShopResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shop(
    shop_data: ShopCreate,
    db: Session = Depends(get_db),
):
    shop = Shop(
        name=shop_data.name,
        owner_name=shop_data.owner_name,
        phone=shop_data.phone,
        address=shop_data.address,
        city=shop_data.city,
        state=shop_data.state,
        pincode=shop_data.pincode,
        gst_number=shop_data.gst_number,
    )

    db.add(shop)
    db.commit()
    db.refresh(shop)

    return shop


# --------------------------------------------------
# GET ALL SHOPS
# --------------------------------------------------

@router.get(
    "",
    response_model=list[ShopResponse],
)
def get_shops(
    db: Session = Depends(get_db),
):
    shops = db.query(Shop).all()

    return shops


# --------------------------------------------------
# GET SHOP BY ID
# --------------------------------------------------

@router.get(
    "/{shop_id}",
    response_model=ShopResponse,
)
def get_shop(
    shop_id: int,
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()

    if not shop:
        raise HTTPException(
            status_code=404,
            detail="Shop not found",
        )

    return shop


# --------------------------------------------------
# UPDATE SHOP
# --------------------------------------------------

@router.put(
    "/{shop_id}",
    response_model=ShopResponse,
)
def update_shop(
    shop_id: int,
    shop_data: ShopUpdate,
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()

    if not shop:
        raise HTTPException(
            status_code=404,
            detail="Shop not found",
        )

    shop.name = shop_data.name
    shop.owner_name = shop_data.owner_name
    shop.phone = shop_data.phone
    shop.address = shop_data.address
    shop.city = shop_data.city
    shop.state = shop_data.state
    shop.pincode = shop_data.pincode
    shop.gst_number = shop_data.gst_number

    db.commit()
    db.refresh(shop)

    return shop

    # --------------------------------------------------
# DELETE SHOP
# --------------------------------------------------

@router.delete(
    "/{shop_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_shop(
    shop_id: int,
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()

    if not shop:
        raise HTTPException(
            status_code=404,
            detail="Shop not found",
        )

    db.delete(shop)
    db.commit()

    return None