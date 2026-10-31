from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    Single shared SQLAlchemy declarative base for all VoiceBill.AI models.

    All model classes (Shop, User, Category, Product, BillingCart,
    BillingCartItem, Sale, SaleItem, Payment) must inherit from this Base
    so that their table definitions are registered in Base.metadata —
    which Alembic uses for autogenerate.
    """
    pass
