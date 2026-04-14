"""
CampusConnect WebSocket Server
Runs on EC2 (persistent connections for real-time location + chat).

Endpoints:
  /ws/order/{order_id}  — Requester + Pilot subscribe here for location, status, chat
  /ws/pilot-mode        — Pilot availability; receives new order notifications
"""

import asyncio
import json
import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query

# Redis for pub/sub across processes
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    yield
    await app.state.redis.close()


app = FastAPI(title="CampusConnect WS", lifespan=lifespan)

# In-memory connection pools (per-process)
# order_id -> set of WebSocket connections
order_connections: dict[str, set[WebSocket]] = defaultdict(set)
# pilot WebSocket connections waiting for new orders
pilot_connections: set[WebSocket] = set()


# ============================================================
# ORDER CHANNEL: location streaming + status updates + chat
# ============================================================
@app.websocket("/ws/order/{order_id}")
async def order_ws(websocket: WebSocket, order_id: str, role: str = Query("requester")):
    """
    Both requester and pilot connect here for a specific order.

    Messages from pilot (role=pilot):
      {"type": "location", "lat": 15.17, "lng": 74.04}
      {"type": "chat", "text": "Samosa is over, getting puffs"}
      {"type": "status", "status": "purchased"}

    Messages from requester (role=requester):
      {"type": "chat", "text": "OK get puffs"}

    Server fans out all messages to all subscribers of this order.
    """
    await websocket.accept()
    order_connections[order_id].add(websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg["role"] = role
            msg["order_id"] = order_id
            msg["timestamp"] = time.time()

            # Fan out to all connections on this order (except sender)
            dead = []
            for conn in order_connections[order_id]:
                if conn is websocket:
                    continue
                try:
                    await conn.send_json(msg)
                except Exception:
                    dead.append(conn)

            # Clean up dead connections
            for conn in dead:
                order_connections[order_id].discard(conn)

            # If location update from pilot, cache in Redis for late-joiners
            if msg.get("type") == "location" and role == "pilot":
                redis = app.state.redis
                await redis.setex(
                    f"pilot_location:{order_id}",
                    300,  # TTL 5 minutes
                    json.dumps({"lat": msg["lat"], "lng": msg["lng"], "ts": msg["timestamp"]}),
                )

    except WebSocketDisconnect:
        order_connections[order_id].discard(websocket)
        if not order_connections[order_id]:
            del order_connections[order_id]


# ============================================================
# PILOT MODE CHANNEL: new order notifications
# ============================================================
@app.websocket("/ws/pilot-mode")
async def pilot_mode_ws(websocket: WebSocket):
    """
    Pilots connect here when they toggle Pilot Mode ON.
    They receive notifications about new orders.

    The REST API publishes new orders to Redis channel "new_orders".
    This WS endpoint subscribes and fans out to connected pilots.
    """
    await websocket.accept()
    pilot_connections.add(websocket)

    redis = app.state.redis
    pubsub = redis.pubsub()
    await pubsub.subscribe("new_orders")

    async def listen_redis():
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                dead = []
                for conn in pilot_connections:
                    try:
                        await conn.send_text(data)
                    except Exception:
                        dead.append(conn)
                for conn in dead:
                    pilot_connections.discard(conn)

    listener_task = asyncio.create_task(listen_redis())

    try:
        while True:
            # Keep connection alive; pilot can also send heartbeat
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pilot_connections.discard(websocket)
        listener_task.cancel()
        await pubsub.unsubscribe("new_orders")


# ============================================================
# REST endpoint: Get last known pilot location for an order
# ============================================================
@app.get("/location/{order_id}")
async def get_pilot_location(order_id: str):
    redis = app.state.redis
    cached = await redis.get(f"pilot_location:{order_id}")
    if cached:
        return json.loads(cached)
    return {"lat": None, "lng": None, "ts": None}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "campusconnect-ws"}
