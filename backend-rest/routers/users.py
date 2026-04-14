from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.database import get_supabase
from core.security import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    hostel_block: Optional[str] = None
    room_number: Optional[str] = None
    upi_vpa: Optional[str] = None


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    db = get_supabase()
    result = db.table("users").select("*").eq("uid", user["uid"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": result.data[0]}


@router.patch("/me")
async def update_me(req: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    update_data = req.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "hostel_block" in update_data and update_data["hostel_block"] not in ("talpona", "terekhol"):
        raise HTTPException(status_code=400, detail="Invalid hostel block")

    db = get_supabase()
    result = db.table("users").update(update_data).eq("uid", user["uid"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": result.data[0]}


@router.get("/{uid}/public")
async def get_public_profile(uid: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    result = (
        db.table("users")
        .select("uid, name, hostel_block, reputation_score, deliveries_count, lifetime_earnings")
        .eq("uid", uid)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": result.data[0]}
