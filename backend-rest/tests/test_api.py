"""
CampusConnect REST API — Test Suite
Run with: cd backend-rest && pytest tests/ -v
"""

import os
import sys
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Set env vars before importing app
os.environ.update({
    "DEV_MODE": "false",  # Tests run with auth enforced
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_SERVICE_KEY": "test-key",
    "JWT_SECRET": "test-jwt-secret-32-chars-long-xx",
    "RESEND_API_KEY": "",
    "OWM_API_KEY": "",
    "VAPID_PUBLIC_KEY": "",
    "VAPID_PRIVATE_KEY": "",
})

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from core.security import create_access_token

client = TestClient(app)


def _auth_header(uid: str = "test-uid-123", email: str = "test@nitgoa.ac.in"):
    token = create_access_token({"uid": uid, "email": email})
    return {"Authorization": f"Bearer {token}"}


# ============================================================
# Health
# ============================================================
class TestHealth:
    def test_health(self):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ============================================================
# Auth
# ============================================================
class TestAuth:
    def test_send_otp_returns_dev_otp(self):
        """In dev mode (no RESEND_API_KEY), OTP is returned in response."""
        r = client.post("/auth/send-otp", json={"email": "test@nitgoa.ac.in"})
        assert r.status_code == 200
        assert r.json()["dev_otp"] is not None
        assert len(r.json()["dev_otp"]) == 4

    def test_send_otp_invalid_email(self):
        r = client.post("/auth/send-otp", json={"email": "not-an-email"})
        assert r.status_code == 422

    @patch("routers.auth.get_supabase")
    def test_verify_otp_wrong_code(self, mock_db):
        # Send OTP first
        r = client.post("/auth/send-otp", json={"email": "wrong@test.com"})
        assert r.status_code == 200

        # Verify with wrong OTP
        r = client.post("/auth/verify-otp", json={"email": "wrong@test.com", "otp": "0000"})
        assert r.status_code == 400

    @patch("routers.auth.get_supabase")
    def test_verify_otp_correct(self, mock_db):
        email = "correct@test.com"
        # Send OTP
        r = client.post("/auth/send-otp", json={"email": email})
        otp = r.json()["dev_otp"]

        # Mock DB: user exists
        mock_client = MagicMock()
        mock_db.return_value = mock_client
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"uid": "uid-1", "email": email, "name": "Test User"}]
        )

        r = client.post("/auth/verify-otp", json={"email": email, "otp": otp})
        assert r.status_code == 200
        assert r.json()["is_new"] is False
        assert "token" in r.json()

    @patch("routers.auth.get_supabase")
    def test_verify_otp_new_user(self, mock_db):
        email = "newuser@test.com"
        r = client.post("/auth/send-otp", json={"email": email})
        otp = r.json()["dev_otp"]

        mock_client = MagicMock()
        mock_db.return_value = mock_client
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[]
        )

        r = client.post("/auth/verify-otp", json={"email": email, "otp": otp})
        assert r.status_code == 200
        assert r.json()["is_new"] is True


# ============================================================
# Menu
# ============================================================
class TestMenu:
    @patch("routers.menu.get_supabase")
    def test_list_menu(self, mock_db):
        mock_client = MagicMock()
        mock_db.return_value = mock_client
        mock_client.table.return_value.select.return_value.eq.return_value.order.return_value.order.return_value.execute.return_value = MagicMock(
            data=[{"id": "1", "name": "Maggi", "price": 30}]
        )

        r = client.get("/menu/")
        assert r.status_code == 200

    @patch("routers.menu.get_supabase")
    def test_surge_endpoint(self, mock_db):
        mock_client = MagicMock()
        mock_db.return_value = mock_client

        # Mock open orders count
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            count=2, data=[]
        )

        r = client.get("/menu/surge")
        assert r.status_code == 200
        assert "surge_multiplier" in r.json()

    @patch("routers.menu.get_supabase")
    def test_drop_locations(self, mock_db):
        mock_client = MagicMock()
        mock_db.return_value = mock_client
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"id": "1", "name": "Talpona Lift", "lat": 15.17, "lng": 74.04}]
        )

        r = client.get("/menu/locations")
        assert r.status_code == 200
        assert len(r.json()["locations"]) == 1


# ============================================================
# Orders
# ============================================================
class TestOrders:
    @patch("routers.orders.get_supabase")
    def test_place_order(self, mock_db):
        mock_client = MagicMock()
        mock_db.return_value = mock_client
        mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "order-1", "status": "open", "incentive": 20}]
        )

        r = client.post(
            "/orders/",
            json={
                "source": "upahar_ghar",
                "items_text": "2x Samosa",
                "estimated_cost": 50,
                "incentive": 20,
                "drop_location_id": "loc-1",
                "drop_location_name": "Talpona Lift",
            },
            headers=_auth_header(),
        )
        assert r.status_code == 200

    def test_place_order_no_auth(self):
        r = client.post(
            "/orders/",
            json={
                "source": "upahar_ghar",
                "items_text": "2x Samosa",
                "estimated_cost": 50,
                "incentive": 20,
                "drop_location_id": "loc-1",
                "drop_location_name": "Talpona Lift",
            },
        )
        assert r.status_code == 401

    @patch("routers.orders.get_supabase")
    def test_place_order_invalid_incentive(self, mock_db):
        r = client.post(
            "/orders/",
            json={
                "source": "upahar_ghar",
                "items_text": "2x Samosa",
                "estimated_cost": 50,
                "incentive": 5,  # Too low
                "drop_location_id": "loc-1",
                "drop_location_name": "Talpona Lift",
            },
            headers=_auth_header(),
        )
        assert r.status_code == 400

    @patch("routers.orders.get_supabase")
    def test_accept_order_race_condition(self, mock_db):
        mock_client = MagicMock()
        mock_db.return_value = mock_client
        # Simulate already-accepted (no rows returned)
        mock_client.table.return_value.update.return_value.eq.return_value.eq.return_value.filter.return_value.execute.return_value = MagicMock(
            data=[]
        )

        r = client.post("/orders/order-1/accept", headers=_auth_header())
        assert r.status_code == 409


# ============================================================
# Users
# ============================================================
class TestUsers:
    @patch("routers.users.get_supabase")
    def test_get_me(self, mock_db):
        mock_client = MagicMock()
        mock_db.return_value = mock_client
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"uid": "test-uid-123", "name": "Test", "email": "test@nitgoa.ac.in"}]
        )

        r = client.get("/users/me", headers=_auth_header())
        assert r.status_code == 200
        assert r.json()["user"]["name"] == "Test"

    def test_get_me_no_auth(self):
        r = client.get("/users/me")
        assert r.status_code == 401

    @patch("routers.users.get_supabase")
    def test_update_me(self, mock_db):
        mock_client = MagicMock()
        mock_db.return_value = mock_client
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"uid": "test-uid-123", "name": "New Name"}]
        )

        r = client.patch("/users/me", json={"name": "New Name"}, headers=_auth_header())
        assert r.status_code == 200

    @patch("routers.users.get_supabase")
    def test_update_me_empty(self, mock_db):
        r = client.patch("/users/me", json={}, headers=_auth_header())
        assert r.status_code == 400

    @patch("routers.users.get_supabase")
    def test_public_profile(self, mock_db):
        mock_client = MagicMock()
        mock_db.return_value = mock_client
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"uid": "uid-2", "name": "Other", "hostel_block": "talpona"}]
        )

        r = client.get("/users/uid-2/public", headers=_auth_header())
        assert r.status_code == 200

    @patch("routers.users.get_supabase")
    def test_public_profile_not_found(self, mock_db):
        mock_client = MagicMock()
        mock_db.return_value = mock_client
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[]
        )

        r = client.get("/users/nonexistent/public", headers=_auth_header())
        assert r.status_code == 404


# ============================================================
# Leaderboard
# ============================================================
class TestLeaderboard:
    @patch("routers.leaderboard.get_supabase")
    def test_leaderboard(self, mock_db):
        mock_client = MagicMock()
        mock_db.return_value = mock_client
        mock_client.rpc.return_value.execute.return_value = MagicMock(
            data=[{"uid": "1", "name": "Top Pilot", "deliveries_count": 50}]
        )

        r = client.get("/leaderboard/", headers=_auth_header())
        assert r.status_code == 200
        assert len(r.json()["leaderboard"]) == 1
