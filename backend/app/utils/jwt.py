from datetime import datetime, timedelta, timezone

from jose import jwt

from app.core.config import settings


ALGORITHM = "HS256"


def create_access_token(data: dict) -> str:
    """
    Create a JWT access token.
    """

    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({
        "exp": expire,
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )

    return encoded_jwt