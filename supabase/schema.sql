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
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own data; pilots can be looked up publicly
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = uid);

-- Orders: requesters and pilots can see their orders; open orders visible to all
CREATE POLICY "Open orders visible to all" ON orders
    FOR SELECT USING (status = 'open' OR requester_uid = auth.uid() OR pilot_uid = auth.uid());

CREATE POLICY "Authenticated users can insert orders" ON orders
    FOR INSERT WITH CHECK (auth.uid() = requester_uid);

CREATE POLICY "Involved users can update orders" ON orders
    FOR UPDATE USING (requester_uid = auth.uid() OR pilot_uid = auth.uid());

-- Ratings: public read, authenticated write
CREATE POLICY "Ratings are public" ON ratings
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can rate" ON ratings
    FOR INSERT WITH CHECK (auth.uid() = rater_uid);

-- Push subscriptions: users manage their own
CREATE POLICY "Users manage own push subs" ON push_subscriptions
    FOR ALL USING (auth.uid() = user_uid);

-- ============================================================
-- SEED DATA: Drop Locations
-- ============================================================
INSERT INTO drop_locations (name, description, lat, lng) VALUES
    ('Talpona Lift', 'Boys Hostel - Talpona Block near lift', 15.1735, 74.0445),
    ('Terekhol Lift', 'Girls Hostel - Terekhol Block near lift', 15.1738, 74.0448),
    ('CSE Department', 'Computer Science Department entrance', 15.1740, 74.0435),
    ('ECE Department', 'Electronics Department entrance', 15.1742, 74.0437),
    ('Mechanical Department', 'Mechanical Department entrance', 15.1744, 74.0439),
    ('Library', 'Central Library main entrance', 15.1741, 74.0441);

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
