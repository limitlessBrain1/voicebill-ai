from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ShopCreate(BaseModel):
    name: str
    owner_name: str
    phone: str
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    gst_number: str | None = None


class ShopUpdate(BaseModel):
    name: str
    owner_name: str
    phone: str
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    gst_number: str | None = None


class ShopResponse(BaseModel):
    id: int
    name: str
    owner_name: str
    phone: str
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    gst_number: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)