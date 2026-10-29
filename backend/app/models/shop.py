from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Shop(Base):
    __tablename__ = "shops"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    name: Mapped[str] = mapped_column(String(150), nullable=False)

    owner_name: Mapped[str] = mapped_column(String(150), nullable=False)

    phone: Mapped[str] = mapped_column(String(20), nullable=False)

    address: Mapped[str | None] = mapped_column(String(255), nullable=True)

    city: Mapped[str | None] = mapped_column(String(100), nullable=True)

    state: Mapped[str | None] = mapped_column(String(100), nullable=True)

    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)

    gst_number: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )