-- CampusConnect: Stored Procedures and Functions
-- Run after schema.sql

-- ============================================================
-- Update reputation score after a new rating
-- ============================================================
CREATE OR REPLACE FUNCTION update_reputation()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users
    SET reputation_score = (
        SELECT ROUND(AVG(score)::numeric, 2)
        FROM ratings
        WHERE rated_uid = NEW.rated_uid
    ),
    updated_at = NOW()
    WHERE uid = NEW.rated_uid;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reputation
    AFTER INSERT ON ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_reputation();

-- ============================================================
-- Update pilot stats on order completion
-- ============================================================
CREATE OR REPLACE FUNCTION update_pilot_stats(p_pilot_uid UUID, p_incentive INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET deliveries_count = deliveries_count + 1,
        lifetime_earnings = lifetime_earnings + p_incentive,
        updated_at = NOW()
    WHERE uid = p_pilot_uid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Update requester stats on order completion
-- ============================================================
CREATE OR REPLACE FUNCTION update_requester_stats(p_requester_uid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET lifetime_ordered = lifetime_ordered + 1,
        updated_at = NOW()
    WHERE uid = p_requester_uid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Leaderboard: Top pilots by deliveries
-- ============================================================
CREATE OR REPLACE FUNCTION get_leaderboard(lim INTEGER DEFAULT 20)
RETURNS TABLE (
    uid UUID,
    name TEXT,
    hostel_block TEXT,
    deliveries_count INTEGER,
    lifetime_earnings INTEGER,
    reputation_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.uid, u.name, u.hostel_block, u.deliveries_count,
           u.lifetime_earnings, u.reputation_score
    FROM users u
    WHERE u.deliveries_count > 0
    ORDER BY u.deliveries_count DESC, u.reputation_score DESC
    LIMIT lim;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trigger_orders_updated
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trigger_menu_updated
    BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
