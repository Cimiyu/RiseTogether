from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app import models
from app.config import (
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from app.database import get_db


# =====================================
# PASSWORD HASHING CONFIGURATION
# =====================================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


# =====================================
# JWT CONFIGURATION
# =====================================

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/users/login"
)


# =====================================
# PASSWORD FUNCTIONS
# =====================================

def hash_password(password: str):
    """
    Convert plain password into hashed password
    """
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
):
    """
    Compare entered password with stored hash
    """
    return pwd_context.verify(
        plain_password,
        hashed_password
    )


# =====================================
# CREATE JWT TOKEN
# =====================================

def create_access_token(data: dict):
    """
    Generate JWT access token
    """

    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(
        minutes=int(ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update({
        "exp": expire
    })

    encoded_jwt = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return encoded_jwt


# =====================================
# VERIFY JWT TOKEN
# =====================================

def verify_token(token: str):

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        return payload

    except JWTError:
        return None


# =====================================
# GET CURRENT LOGGED-IN USER
# =====================================

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )


    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )


        email: str = payload.get("sub")


        if email is None:
            raise credentials_exception


    except JWTError:

        raise credentials_exception



    user = (
        db.query(models.User)
        .filter(
            models.User.email == email
        )
        .first()
    )


    if user is None:
        raise credentials_exception


    return user
