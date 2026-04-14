import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

try:
    from pywebpush import webpush, WebPushException
except ImportError:
    webpush = None  # type: ignore
    WebPushException = Exception  # type: ignore

from core.config import settings
from core.database import get_supabase
from core.security import get_current_user

router = APIRouter(prefix="/push", tags=["push"])


class PushSubscription(BaseModel):
    endpoint: str
    p256dh: str
    auth_key: str


@router.post("/subscribe")
async def subscribe(req: PushSubscription, user: dict = Depends(get_current_user)):
    db = get_supabase()
    data = {
        "user_uid": user["uid"],
        "endpoint": req.endpoint,
        "p256dh": req.p256dh,
        "auth_key": req.auth_key,
    }
    # Upsert: if same user+endpoint exists, update keys
    db.table("push_subscriptions").upsert(data, on_conflict="user_uid,endpoint").execute()
    return {"message": "Subscribed"}


@router.delete("/unsubscribe")
async def unsubscribe(endpoint: str, user: dict = Depends(get_current_user)):
    db = get_supabase()
    db.table("push_subscriptions").delete().eq("user_uid", user["uid"]).eq("endpoint", endpoint).execute()
    return {"message": "Unsubscribed"}


async def notify_pilots_new_order(order: dict):
    """Send push notification to all active pilots about a new order."""
    if not settings.vapid_private_key or webpush is None:
        return

    db = get_supabase()
    # Get all active pilot subscriptions
    active_pilots = (
        db.table("users")
        .select("uid")
        .eq("is_active_pilot", True)
        .neq("uid", order["requester_uid"])
        .execute()
    )

    if not active_pilots.data:
        return

    pilot_uids = [p["uid"] for p in active_pilots.data]

    subs = (
        db.table("push_subscriptions")
        .select("*")
        .in_("user_uid", pilot_uids)
        .execute()
    )

    payload = json.dumps({
        "title": "New Mission Available!",
        "body": f"{order['items_text']} → {order['drop_location_name']} (₹{order['incentive']} incentive)",
        "url": "/pilot",
    })

    for sub in subs.data or []:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth_key"]},
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_email},
            )
        except WebPushException:
            # Remove stale subscription
            db.table("push_subscriptions").delete().eq("id", sub["id"]).execute()
        except Exception:
            pass
