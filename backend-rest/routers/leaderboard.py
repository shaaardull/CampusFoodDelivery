from fastapi import APIRouter, Depends, Query

from core.database import get_supabase
from core.security import get_current_user

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("/")
async def get_leaderboard(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    db = get_supabase()
    try:
        result = db.rpc("get_leaderboard", {"lim": limit}).execute()
        return {"leaderboard": result.data}
    except Exception:
        # Fallback if function not created yet
        result = (
            db.table("users")
            .select("uid, name, hostel_block, deliveries_count, lifetime_earnings, reputation_score")
            .gt("deliveries_count", 0)
            .order("deliveries_count", desc=True)
            .limit(limit)
            .execute()
        )
        return {"leaderboard": result.data}
