from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from routers import auth, orders, menu, users, leaderboard, push

app = FastAPI(
    title="CampusConnect API",
    description="Hyper-local P2P food delivery for NIT Goa",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(orders.router)
app.include_router(menu.router)
app.include_router(users.router)
app.include_router(leaderboard.router)
app.include_router(push.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "campusconnect-rest"}


# Lambda handler via Mangum
handler = Mangum(app, lifespan="off")
