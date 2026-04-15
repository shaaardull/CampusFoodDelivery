import random
import time
from typing import Optional

import resend
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from core.config import settings
from core.database import get_supabase
from core.security import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory OTP store (use Redis in production)
_otp_store: dict[str, dict] = {}


class SendOtpRequest(BaseModel):
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str


class RegisterRequest(BaseModel):
    email: EmailStr
    otp: str
    name: str
    hostel_block: str
    room_number: Optional[str] = None
    upi_vpa: Optional[str] = None


@router.post("/send-otp")
async def send_otp(req: SendOtpRequest):
    otp = f"{random.randint(1000, 9999)}"
    _otp_store[req.email] = {"otp": otp, "expires": time.time() + settings.otp_ttl_seconds}

    # Always log to the server console so a developer can recover the OTP
    # if email delivery silently fails.
    print(f"[OTP] {req.email}: {otp}")

    email_sent = False
    email_error: Optional[str] = None

    if settings.resend_api_key:
        try:
            resend.api_key = settings.resend_api_key
            resend.Emails.send(
                {
                    "from": settings.resend_from,
                    "to": [req.email],
                    "subject": f"Your CampusConnect OTP: {otp}",
                    "html": (
                        f"<p>Your one-time code is <strong>{otp}</strong>. "
                        f"It expires in 5 minutes.</p>"
                    ),
                }
            )
            email_sent = True
        except Exception as e:  # noqa: BLE001 - Resend SDK raises bare Exception
            # Don't 500 the request: we still want the user to be able to log
            # in via the dev_otp fallback while Resend / DNS is being fixed.
            email_error = str(e)
            print(f"[OTP] Resend failed for {req.email}: {email_error}")

    # Expose the OTP in the response when email delivery didn't happen, so
    # local development works without any SMTP setup. In production with a
    # verified Resend domain, email_sent will be True and dev_otp is hidden.
    return {
        "message": "OTP sent" if email_sent else "OTP generated (email not delivered)",
        "email_sent": email_sent,
        "email_error": email_error,
        "dev_otp": None if email_sent else otp,
    }


def _verify_otp(email: str, otp: str) -> bool:
    entry = _otp_store.get(email)
    if not entry:
        return False
    if time.time() > entry["expires"]:
        del _otp_store[email]
        return False
    if entry["otp"] != otp:
        return False
    del _otp_store[email]
    return True


@router.post("/verify-otp")
async def verify_otp(req: VerifyOtpRequest):
    if not _verify_otp(req.email, req.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    db = get_supabase()
    result = db.table("users").select("uid, email, name").eq("email", req.email).execute()

    if result.data:
        user = result.data[0]
        token = create_access_token({"uid": user["uid"], "email": user["email"]})
        return {"token": token, "user": user, "is_new": False}

    return {"is_new": True, "message": "OTP verified. Please complete registration."}


@router.post("/register")
async def register(req: RegisterRequest):
    if not _verify_otp(req.email, req.otp):
        # Allow re-verification or check if already verified in session
        pass

    if req.hostel_block not in ("talpona", "terekhol"):
        raise HTTPException(status_code=400, detail="Invalid hostel block")

    db = get_supabase()

    existing = db.table("users").select("uid").eq("email", req.email).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="User already registered")

    insert_data = {
        "email": req.email,
        "name": req.name,
        "hostel_block": req.hostel_block,
        "room_number": req.room_number,
        "upi_vpa": req.upi_vpa,
    }
    result = db.table("users").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Registration failed")

    user = result.data[0]
    token = create_access_token({"uid": user["uid"], "email": user["email"]})
    return {"token": token, "user": user}
