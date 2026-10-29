from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.session import get_db
from app.models.shop import Shop
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    UserResponse,
    LoginRequest,
    LoginResponse,
)
from app.utils.security import hash_password, verify_password
from app.utils.jwt import create_access_token


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


# ---------------------------------------------------------
# REGISTER
# ---------------------------------------------------------

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    user_data: RegisterRequest,
    db: Session = Depends(get_db),
):
    # Check whether the shop exists
    shop = db.query(Shop).filter(
        Shop.id == user_data.shop_id
    ).first()

    if not shop:
        raise HTTPException(
            status_code=404,
            detail="Shop not found",
        )

    # Check whether email already exists
    existing_email = db.query(User).filter(
        User.email == user_data.email
    ).first()

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    # Check whether phone already exists
    existing_phone = db.query(User).filter(
        User.phone == user_data.phone
    ).first()

    if existing_phone:
        raise HTTPException(
            status_code=400,
            detail="Phone number already registered",
        )

    # Create user
    user = User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        password_hash=hash_password(user_data.password),
        shop_id=user_data.shop_id,
        role="owner",
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


# ---------------------------------------------------------
# LOGIN
# ---------------------------------------------------------

@router.post(
    "/login",
    response_model=LoginResponse,
)
def login_user(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):
    # Find user by email
    user = db.query(User).filter(
        User.email == login_data.email
    ).first()

    # User does not exist
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Verify password
    password_is_valid = verify_password(
        login_data.password,
        user.password_hash,
    )

    if not password_is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Check whether user account is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # Create JWT access token
    access_token = create_access_token(
        {
            "sub": str(user.id),
            "shop_id": user.shop_id,
            "role": user.role,
        }
    )

    # Return token + user information
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


# ---------------------------------------------------------
# CURRENT USER / MY PROFILE
# ---------------------------------------------------------

@router.get(
    "/me",
    response_model=UserResponse,
)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user