-- CampusConnect: Supabase PostgreSQL Schema
-- Run this first against your Supabase project

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE users (
    uid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    hostel_block TEXT NOT NULL CHECK (hostel_block IN ('talpona', 'terekhol')),
    room_number TEXT,
    upi_vpa TEXT,
    reputation_score NUMERIC(3,2) DEFAULT 5.00 CHECK (reputation_score >= 0 AND reputation_score <= 5),
    lifetime_earnings INTEGER DEFAULT 0,
    lifetime_ordered INTEGER DEFAULT 0,
    deliveries_count INTEGER DEFAULT 0,
    is_active_pilot BOOLEAN DEFAULT FALSE,
    current_geohash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active_pilot ON users(is_active_pilot) WHERE is_active_pilot = TRUE;
CREATE INDEX idx_users_geohash ON users(current_geohash) WHERE current_geohash IS NOT NULL;

-- ============================================================
-- DROP LOCATIONS TABLE
-- ============================================================
CREATE TABLE drop_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- MENU ITEMS TABLE
-- ============================================================
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL CHECK (source IN ('upahar_ghar', 'nescafe')),
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('snacks', 'beverages', 'meals', 'desserts')),
    is_available BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_menu_source ON menu_items(source);
CREATE INDEX idx_menu_available ON menu_items(is_available) WHERE is_available = TRUE;

-- ============================================================
-- ORDERS TABLE
-- ============================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_uid UUID NOT NULL REFERENCES users(uid),
    pilot_uid UUID REFERENCES users(uid),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
        'open', 'accepted', 'purchased', 'in_transit', 'arrived', 'completed', 'cancelled'
    )),
    source TEXT NOT NULL CHECK (source IN ('upahar_ghar', 'nescafe')),
    items_text TEXT NOT NULL,
    estimated_cost INTEGER NOT NULL,
    incentive INTEGER NOT NULL CHECK (incentive >= 10 AND incentive <= 50),
    total_amount INTEGER GENERATED ALWAYS AS (estimated_cost + incentive) STORED,
    drop_location_id UUID REFERENCES drop_locations(id),
    drop_location_name TEXT NOT NULL,
    floor_number TEXT,
    handover_otp TEXT,
    special_instructions TEXT,
    surge_multiplier NUMERIC(3,2) DEFAULT 1.00,
    accepted_at TIMESTAMPTZ,
    purchased_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_requester ON orders(requester_uid);
CREATE INDEX idx_orders_pilot ON orders(pilot_uid);
CREATE INDEX idx_orders_source ON orders(source);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- ============================================================
-- ORDER ITEMS TABLE (structured items, optional alongside items_text)
-- ============================================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id),
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================================
-- RATINGS TABLE
-- ============================================================
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id),
    rater_uid UUID NOT NULL REFERENCES users(uid),
    rated_uid UUID NOT NULL REFERENCES users(uid),
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ratings_rated ON ratings(rated_uid);

-- ============================================================
-- PUSH SUBSCRIPTIONS TABLE
-- ============================================================
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uid UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_uid, endpoint)
);

CREATE INDEX idx_push_user ON push_subscriptions(user_uid);

-- ============================================================
-- AUDIT LOG TABLE
-- ============================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_uid UUID REFERENCES users(uid),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- NOTE: All table access is mediated by the FastAPI backend using the Supabase
-- service role key. Authorization (who can read/update which order, etc.) is
-- enforced in the API layer (see backend-rest/routers/*). We therefore disable
-- RLS on tables the backend mutates, because PostgREST/supabase-py policies
-- based on auth.uid() don't apply in server-to-server calls.
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE ratings DISABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED DATA: Drop Locations (NIT Goa campus coordinates)
-- ============================================================
INSERT INTO drop_locations (name, description, lat, lng) VALUES
    ('Talpona Hostel',     'Boys Hostel - Talpona Block near lift',           15.171168,  74.015692),
    ('Terekhol Hostel',    'Girls Hostel - Terekhol Block near lift',         15.170016,  74.012100),
    ('Mechanical Dept',    'Mechanical Engineering Department entrance',       15.1697079, 74.0127932),
    ('Civil Dept',         'Civil Engineering Department entrance',            15.1695920, 74.0134207),
    ('ECE Dept',           'Electronics & Communication Department entrance',  15.168814,  74.012959),
    ('CSE Dept',           'Computer Science Department entrance',             15.168811,  74.013550),
    ('Library Block',      'Central Library main entrance',                    15.169233,  74.012713),
    ('Gyan Mandir',        'Gyan Mandir academic block',                       15.1690189, 74.0117258);

-- ============================================================
-- SEED DATA: Menu Items (Upahar Ghar)
-- ============================================================
INSERT INTO menu_items (source, name, price, category) VALUES
    ('upahar_ghar', 'Masala Dosa', 50, 'meals'),
    ('upahar_ghar', 'Plain Dosa', 40, 'meals'),
    ('upahar_ghar', 'Idli (2 pcs)', 30, 'snacks'),
    ('upahar_ghar', 'Vada Pav', 20, 'snacks'),
    ('upahar_ghar', 'Samosa (2 pcs)', 25, 'snacks'),
    ('upahar_ghar', 'Pav Bhaji', 50, 'meals'),
    ('upahar_ghar', 'Fried Rice', 60, 'meals'),
    ('upahar_ghar', 'Manchurian', 55, 'meals'),
    ('upahar_ghar', 'Tea', 15, 'beverages'),
    ('upahar_ghar', 'Coffee', 20, 'beverages'),
    ('upahar_ghar', 'Lassi', 30, 'beverages'),
    ('upahar_ghar', 'Buttermilk', 20, 'beverages'),
    ('upahar_ghar', 'Gulab Jamun (2 pcs)', 30, 'desserts'),
    ('upahar_ghar', 'Jalebi', 25, 'desserts');

-- ============================================================
-- SEED DATA: Menu Items (Nescafe)
-- ============================================================
INSERT INTO menu_items (source, name, price, category) VALUES
    ('nescafe', 'Cold Coffee', 50, 'beverages'),
    ('nescafe', 'Hot Coffee', 30, 'beverages'),
    ('nescafe', 'Cappuccino', 40, 'beverages'),
    ('nescafe', 'Green Tea', 25, 'beverages'),
    ('nescafe', 'Lemon Tea', 25, 'beverages'),
    ('nescafe', 'Maggi', 30, 'snacks'),
    ('nescafe', 'Bread Omelette', 35, 'snacks'),
    ('nescafe', 'Sandwich (Veg)', 40, 'snacks'),
    ('nescafe', 'Sandwich (Chicken)', 50, 'snacks'),
    ('nescafe', 'French Fries', 40, 'snacks'),
    ('nescafe', 'Brownie', 35, 'desserts'),
    ('nescafe', 'Pastry', 30, 'desserts');
