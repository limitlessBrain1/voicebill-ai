from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CategoryCreate(BaseModel):
    name: str


class CategoryUpdate(BaseModel):
    name: str


class CategoryResponse(BaseModel):
    id: int
    name: str
    shop_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)