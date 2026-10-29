from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str
    shop_id: int


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: str
    shop_id: int
    role: str
    is_active: bool

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse