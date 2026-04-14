import random
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

from core.database import get_supabase
from core.security import get_current_user

router = APIRouter(prefix="/orders", tags=["orders"])


class PlaceOrderRequest(BaseModel):
    source: str  # 'upahar_ghar' or 'nescafe'
    items_text: str
    estimated_cost: int
    incentive: int  # 10-50
    drop_location_id: str
    drop_location_name: str
    floor_number: Optional[str] = None
    special_instructions: Optional[str] = None


class RateOrderRequest(BaseModel):
    score: int  # 1-5
    comment: Optional[str] = None


@router.post("/")
async def place_order(req: PlaceOrderRequest, user: dict = Depends(get_current_user)):
    if req.source not in ("upahar_ghar", "nescafe"):
        raise HTTPException(status_code=400, detail="Invalid source")
    if req.incentive < 10 or req.incentive > 50:
        raise HTTPException(status_code=400, detail="Incentive must be between 10 and 50")

    db = get_supabase()
    otp = f"{random.randint(1000, 9999)}"

    order_data = {
        "requester_uid": user["uid"],
        "source": req.source,
        "items_text": req.items_text,
        "estimated_cost": req.estimated_cost,
        "incentive": req.incentive,
        "drop_location_id": req.drop_location_id,
        "drop_location_name": req.drop_location_name,
        "floor_number": req.floor_number,
        "special_instructions": req.special_instructions,
        "handover_otp": otp,
        "status": "open",
    }

    result = db.table("orders").insert(order_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create order")

    order = result.data[0]

    # Notify active pilots via push (best-effort)
    try:
        from routers.push import notify_pilots_new_order
        await notify_pilots_new_order(order)
    except Exception:
        pass  # Push is best-effort

    return {"order": order}


@router.get("/open")
async def list_open_orders(source: Optional[str] = None, user: dict = Depends(get_current_user)):
    db = get_supabase()
    query = db.table("orders").select("*, requester:users!requester_uid(name, hostel_block)").eq("status", "open")
    if source:
        query = query.eq("source", source)
    result = query.order("created_at", desc=True).limit(50).execute()
    return {"orders": result.data}


@router.get("/my")
async def my_orders(user: dict = Depends(get_current_user)):
    db = get_supabase()
    result = (
        db.table("orders")
        .select("*")
        .or_(f"requester_uid.eq.{user['uid']},pilot_uid.eq.{user['uid']}")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"orders": result.data}


@router.get("/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    result = db.table("orders").select("*").eq("id", order_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = result.data[0]
    # Hide OTP from pilot
    if order.get("pilot_uid") == user["uid"]:
        order.pop("handover_otp", None)

    return {"order": order}


@router.post("/{order_id}/accept")
async def accept_order(order_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()

    # Check order is open and unassigned
    check = db.table("orders").select("*").eq("id", order_id).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = check.data[0]

    if order["status"] != "open" or order.get("pilot_uid") not in (None, "", "null"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot accept: status={order['status']}, pilot_uid={order['pilot_uid']}"
        )

    # Update the order
    db.table("orders").update(
        {"pilot_uid": user["uid"], "status": "accepted", "accepted_at": _now()}
    ).eq("id", order_id).execute()

    # Re-fetch to confirm and return updated order
    updated = db.table("orders").select("*").eq("id", order_id).execute()
    if not updated.data or updated.data[0]["status"] != "accepted":
        raise HTTPException(status_code=500, detail="Failed to accept order")

    return {"order": updated.data[0]}


@router.post("/{order_id}/status")
async def advance_status(order_id: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    order_result = db.table("orders").select("*").eq("id", order_id).execute()
    if not order_result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = order_result.data[0]
    if order["pilot_uid"] != user["uid"]:
        raise HTTPException(status_code=403, detail="Only the pilot can advance status")

    transitions = {
        "accepted": "purchased",
        "purchased": "in_transit",
        "in_transit": "arrived",
    }
    current = order["status"]
    next_status = transitions.get(current)
    if not next_status:
        raise HTTPException(status_code=400, detail=f"Cannot advance from {current}")

    update_data = {"status": next_status}
    if next_status == "purchased":
        update_data["purchased_at"] = _now()

    db.table("orders").update(update_data).eq("id", order_id).execute()
    updated = db.table("orders").select("*").eq("id", order_id).execute()
    return {"order": updated.data[0]}


@router.post("/{order_id}/complete")
async def complete_order(order_id: str, otp: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    order_result = db.table("orders").select("*").eq("id", order_id).execute()
    if not order_result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = order_result.data[0]
    if order["pilot_uid"] != user["uid"]:
        raise HTTPException(status_code=403, detail="Only the pilot can complete")
    if order["status"] != "arrived":
        raise HTTPException(status_code=400, detail="Order must be in 'arrived' status")
    if order["handover_otp"] != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    db.table("orders").update({"status": "completed", "completed_at": _now()}).eq("id", order_id).execute()

    # Update pilot stats
    try:
        db.rpc("update_pilot_stats", {"p_pilot_uid": order["pilot_uid"], "p_incentive": order["incentive"]}).execute()
        db.rpc("update_requester_stats", {"p_requester_uid": order["requester_uid"]}).execute()
    except Exception:
        pass  # Stats update is best-effort

    updated = db.table("orders").select("*").eq("id", order_id).execute()
    return {"order": updated.data[0]}


@router.post("/{order_id}/cancel")
async def cancel_order(order_id: str, reason: Optional[str] = None, user: dict = Depends(get_current_user)):
    db = get_supabase()
    order_result = db.table("orders").select("*").eq("id", order_id).execute()
    if not order_result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = order_result.data[0]
    if order["requester_uid"] != user["uid"] and order.get("pilot_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if order["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Order already finalized")

    db.table("orders").update(
        {"status": "cancelled", "cancelled_at": _now(), "cancellation_reason": reason}
    ).eq("id", order_id).execute()

    updated = db.table("orders").select("*").eq("id", order_id).execute()
    return {"order": updated.data[0]}


@router.post("/{order_id}/rate")
async def rate_order(order_id: str, req: RateOrderRequest, user: dict = Depends(get_current_user)):
    if req.score < 1 or req.score > 5:
        raise HTTPException(status_code=400, detail="Score must be 1-5")

    db = get_supabase()
    order_result = db.table("orders").select("*").eq("id", order_id).execute()
    if not order_result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = order_result.data[0]
    if order["status"] != "completed":
        raise HTTPException(status_code=400, detail="Can only rate completed orders")
    if order["requester_uid"] != user["uid"]:
        raise HTTPException(status_code=403, detail="Only requester can rate")

    # Check if already rated
    existing = db.table("ratings").select("id").eq("order_id", order_id).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="Already rated")

    rating_data = {
        "order_id": order_id,
        "rater_uid": user["uid"],
        "rated_uid": order["pilot_uid"],
        "score": req.score,
        "comment": req.comment,
    }
    result = db.table("ratings").insert(rating_data).execute()
    return {"rating": result.data[0]}
