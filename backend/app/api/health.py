from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.session import get_db


router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "VoiceBill AI backend is running"
    }


@router.get("/health/db")
def database_health_check(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": "connected",
        "result": result.scalar()
    }