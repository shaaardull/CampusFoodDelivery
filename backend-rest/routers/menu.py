from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.config import settings
from core.database import get_supabase
from core.security import get_current_user

router = APIRouter(prefix="/menu", tags=["menu"])


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[int] = None
    category: Optional[str] = None
    is_available: Optional[bool] = None


@router.get("/")
async def list_menu(
    source: Optional[str] = Query(None, description="upahar_ghar or nescafe"),
    category: Optional[str] = Query(None),
):
    db = get_supabase()
    query = db.table("menu_items").select("*").eq("is_available", True)
    if source:
        query = query.eq("source", source)
    if category:
        query = query.eq("category", category)
    result = query.order("category").order("name").execute()
    return {"items": result.data}


@router.get("/surge")
async def get_surge_info():
    """Calculate surge multiplier based on weather and demand."""
    db = get_supabase()

    # Count open orders vs active pilots
    open_orders = db.table("orders").select("id", count="exact").eq("status", "open").execute()
    active_pilots = db.table("users").select("uid", count="exact").eq("is_active_pilot", True).execute()

    order_count = open_orders.count or 0
    pilot_count = active_pilots.count or 0

    # Demand factor: if more orders than pilots, surge up
    beta_demand = 0.0
    if pilot_count > 0 and order_count > pilot_count:
        beta_demand = min(0.5, (order_count - pilot_count) / pilot_count * 0.2)
    elif pilot_count == 0 and order_count > 0:
        beta_demand = 0.5

    # Weather factor (optional)
    alpha_weather = 0.0
    if settings.owm_api_key:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.openweathermap.org/data/2.5/weather",
                    params={"lat": 15.1735, "lon": 74.0445, "appid": settings.owm_api_key},
                    timeout=5.0,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    rain_1h = data.get("rain", {}).get("1h", 0)
                    if rain_1h > 5:
                        alpha_weather = 0.5
                    elif rain_1h > 2:
                        alpha_weather = 0.3
                    elif rain_1h > 0:
                        alpha_weather = 0.1
        except Exception:
            pass  # Weather is best-effort

    multiplier = round(1.0 + alpha_weather + beta_demand, 2)

    return {
        "surge_multiplier": multiplier,
        "open_orders": order_count,
        "active_pilots": pilot_count,
        "is_raining": alpha_weather > 0,
        "message": _surge_message(multiplier),
    }


def _surge_message(multiplier: float) -> str:
    if multiplier >= 1.5:
        return "High demand! Consider bumping your incentive."
    elif multiplier >= 1.2:
        return "Moderate demand. Orders may take a bit longer."
    return "Normal conditions."


@router.get("/locations")
async def list_drop_locations():
    db = get_supabase()
    result = db.table("drop_locations").select("*").eq("is_active", True).execute()
    return {"locations": result.data}


@router.patch("/{item_id}")
async def update_menu_item(
    item_id: str, req: MenuItemUpdate, user: dict = Depends(get_current_user)
):
    db = get_supabase()
    update_data = req.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = db.table("menu_items").update(update_data).eq("id", item_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return {"item": result.data[0]}
