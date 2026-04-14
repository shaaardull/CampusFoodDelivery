from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _get_or_create_dev_user() -> dict:
    """In dev mode, return a default dev user. Creates one in DB if needed."""
    if settings.dev_user_uid:
        return {"uid": settings.dev_user_uid, "email": "dev@campusconnect.dev"}

    from core.database import get_supabase
    db = get_supabase()

    # Check if dev user exists
    result = db.table("users").select("uid, email").eq("email", "dev@campusconnect.dev").execute()
    if result.data:
        settings.dev_user_uid = result.data[0]["uid"]
        return {"uid": result.data[0]["uid"], "email": result.data[0]["email"]}

    # Create dev user
    result = db.table("users").insert({
        "email": "dev@campusconnect.dev",
        "name": "Dev User",
        "hostel_block": "talpona",
        "room_number": "101",
    }).execute()

    if result.data:
        settings.dev_user_uid = result.data[0]["uid"]
        return {"uid": result.data[0]["uid"], "email": result.data[0]["email"]}

    raise HTTPException(status_code=500, detail="Could not create dev user")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    # Dev mode: skip auth entirely, use a default dev user
    if settings.dev_mode:
        if credentials:
            # If a token is provided even in dev mode, use it
            payload = decode_access_token(credentials.credentials)
            uid = payload.get("uid")
            if uid:
                return {"uid": uid, "email": payload.get("email", "")}
        return _get_or_create_dev_user()

    # Production mode: require valid JWT
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(credentials.credentials)
    uid = payload.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return {"uid": uid, "email": payload.get("email", "")}
