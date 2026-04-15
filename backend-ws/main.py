"""
CampusConnect WebSocket Server
Runs on EC2 (persistent connections for real-time location + chat).

Endpoints:
  /ws/order/{order_id}  — Requester + Pilot subscribe here for location, status, chat
  /ws/pilot-mode        — Pilot availability; receives new order notifications

Redis is optional. If REDIS_URL is unreachable (or the redis package is not
installed), the server falls back to an in-memory location cache and the
pilot-mode channel simply won't receive cross-process new-order broadcasts.
That's fine for local single-process development; production should run Redis.
"""

import asyncio
import json
import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

try:
    import redis.asyncio as aioredis  # type: ignore
except ImportError:  # pragma: no cover
    aioredis = None  # type: ignore

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# In-memory fallback caches (used when Redis is unavailable)
_local_location_cache: dict[str, dict] = {}


async def _try_connect_redis():
    """Return a connected Redis client, or None if unavailable."""
    if aioredis is None:
        print("[ws] redis package not installed — using in-memory fallbacks")
        return None
    try:
        client = aioredis.from_url(REDIS_URL, decode_responses=True)
        await client.ping()
        print(f"[ws] connected to Redis at {REDIS_URL}")
        return client
    except Exception as e:
        print(f"[ws] Redis unavailable ({e}) — using in-memory fallbacks")
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = await _try_connect_redis()
    yield
    if app.state.redis is not None:
        await app.state.redis.close()


app = FastAPI(title="CampusConnect WS", lifespan=lifespan)

# Allow the Next.js frontend to call /location/{order_id} cross-origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

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

    # On connect, send the cached pilot location (if any) so a late-joining
    # requester gets a marker immediately instead of an empty map.
    if role == "requester":
        cached = await _get_cached_location(websocket.app, order_id)
        if cached and cached.get("lat") is not None:
            try:
                await websocket.send_json(
                    {
                        "type": "location",
                        "lat": cached["lat"],
                        "lng": cached["lng"],
                        "role": "pilot",
                        "order_id": order_id,
                        "timestamp": cached.get("ts", time.time()),
                    }
                )
            except Exception:
                pass

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

            # If location update from pilot, cache for late-joiners
            if msg.get("type") == "location" and role == "pilot":
                await _set_cached_location(
                    websocket.app,
                    order_id,
                    {"lat": msg["lat"], "lng": msg["lng"], "ts": msg["timestamp"]},
                )

    except WebSocketDisconnect:
        order_connections[order_id].discard(websocket)
        if not order_connections[order_id]:
            del order_connections[order_id]


async def _get_cached_location(app_obj, order_id: str) -> Optional[dict]:
    redis = app_obj.state.redis
    if redis is not None:
        try:
            cached = await redis.get(f"pilot_location:{order_id}")
            if cached:
                return json.loads(cached)
        except Exception as e:
            print(f"[ws] redis get failed: {e}")
    return _local_location_cache.get(order_id)


async def _set_cached_location(app_obj, order_id: str, payload: dict) -> None:
    redis = app_obj.state.redis
    if redis is not None:
        try:
            await redis.setex(
                f"pilot_location:{order_id}",
                300,  # TTL 5 minutes
                json.dumps(payload),
            )
            return
        except Exception as e:
            print(f"[ws] redis setex failed: {e}")
    # Fallback: in-memory (no TTL, fine for dev)
    _local_location_cache[order_id] = payload


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
    When Redis is unavailable we simply accept the connection and keep
    it alive — new-order push won't work but the pilot UI still polls
    /orders/open via the REST API.
    """
    await websocket.accept()
    pilot_connections.add(websocket)

    redis = websocket.app.state.redis
    listener_task: asyncio.Task | None = None
    pubsub = None

    if redis is not None:
        try:
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
        except Exception as e:
            print(f"[ws] redis pubsub setup failed: {e}")
            pubsub = None

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
        if listener_task is not None:
            listener_task.cancel()
        if pubsub is not None:
            try:
                await pubsub.unsubscribe("new_orders")
            except Exception:
                pass


# ============================================================
# REST endpoint: Get last known pilot location for an order
# ============================================================
@app.get("/location/{order_id}")
async def get_pilot_location(order_id: str):
    cached = await _get_cached_location(app, order_id)
    if cached:
        return cached
    return {"lat": None, "lng": None, "ts": None}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "campusconnect-ws",
        "redis": app.state.redis is not None,
    }
