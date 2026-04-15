-- Dummy data for local / staging testing.
-- Safe to run multiple times: uses ON CONFLICT on unique columns.
-- To wipe and reseed, run `TRUNCATE users CASCADE;` first (this will also
-- wipe orders, ratings, etc.)

BEGIN;

-- ============================================================
-- 20 dummy users (mix of Talpona / Terekhol, varied stats)
-- ============================================================
INSERT INTO users (email, name, hostel_block, room_number, upi_vpa,
                   reputation_score, lifetime_earnings, lifetime_ordered,
                   deliveries_count, is_active_pilot)
VALUES
    ('aarav.sharma@nitgoa.ac.in',    'Aarav Sharma',    'talpona',  'T-101', 'aarav@upi',     4.90,  850,  22, 34, TRUE),
    ('vivaan.patel@nitgoa.ac.in',    'Vivaan Patel',    'talpona',  'T-203', 'vivaan@upi',    4.80,  620,  14, 26, TRUE),
    ('aditya.singh@nitgoa.ac.in',    'Aditya Singh',    'talpona',  'T-112', 'aditya@upi',    4.50,  310,   8, 12, FALSE),
    ('rohan.kumar@nitgoa.ac.in',     'Rohan Kumar',     'talpona',  'T-305', 'rohan@upi',     4.70,  980,  30, 41, TRUE),
    ('arjun.gupta@nitgoa.ac.in',     'Arjun Gupta',     'talpona',  'T-209', 'arjun@upi',     4.20,  150,   5,  7, FALSE),
    ('ishaan.verma@nitgoa.ac.in',    'Ishaan Verma',    'talpona',  'T-118', 'ishaan@upi',    5.00, 1240,  18, 52, TRUE),
    ('kabir.reddy@nitgoa.ac.in',     'Kabir Reddy',     'talpona',  'T-220', 'kabir@upi',     4.60,  460,  11, 18, FALSE),
    ('yash.mehta@nitgoa.ac.in',      'Yash Mehta',      'talpona',  'T-301', 'yash@upi',      4.30,  280,  17, 10, FALSE),
    ('dhruv.jain@nitgoa.ac.in',      'Dhruv Jain',      'talpona',  'T-115', 'dhruv@upi',     4.90,  720,  25, 29, TRUE),
    ('rahul.khanna@nitgoa.ac.in',    'Rahul Khanna',    'talpona',  'T-210', 'rahul@upi',     4.40,  190,   9,  8, FALSE),
    ('ananya.nair@nitgoa.ac.in',     'Ananya Nair',     'terekhol', 'K-104', 'ananya@upi',    4.95, 1100,  20, 44, TRUE),
    ('diya.iyer@nitgoa.ac.in',       'Diya Iyer',       'terekhol', 'K-207', 'diya@upi',      4.70,  540,  27, 21, FALSE),
    ('saanvi.menon@nitgoa.ac.in',    'Saanvi Menon',    'terekhol', 'K-115', 'saanvi@upi',    4.80,  890,  15, 36, TRUE),
    ('myra.shetty@nitgoa.ac.in',     'Myra Shetty',     'terekhol', 'K-310', 'myra@upi',      4.60,  410,  13, 17, FALSE),
    ('aadhya.rao@nitgoa.ac.in',      'Aadhya Rao',      'terekhol', 'K-119', 'aadhya@upi',    5.00, 1350,  11, 56, TRUE),
    ('anika.joshi@nitgoa.ac.in',     'Anika Joshi',     'terekhol', 'K-212', 'anika@upi',     4.30,  230,  19,  9, FALSE),
    ('kiara.pillai@nitgoa.ac.in',    'Kiara Pillai',    'terekhol', 'K-108', 'kiara@upi',     4.85,  670,  24, 27, TRUE),
    ('riya.chopra@nitgoa.ac.in',     'Riya Chopra',     'terekhol', 'K-303', 'riya@upi',      4.50,  340,  22, 13, FALSE),
    ('navya.bhat@nitgoa.ac.in',      'Navya Bhat',      'terekhol', 'K-117', 'navya@upi',     4.75,  820,  16, 32, TRUE),
    ('tara.desai@nitgoa.ac.in',      'Tara Desai',      'terekhol', 'K-209', 'tara@upi',      4.40,  260,   7, 11, FALSE)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- 8 open orders from random requesters (no pilot yet).
-- ============================================================
WITH
  pick_source AS (
    SELECT unnest(ARRAY['upahar_ghar','nescafe','upahar_ghar','nescafe',
                        'upahar_ghar','nescafe','upahar_ghar','nescafe']) AS source,
           generate_series(1, 8) AS n
  ),
  pick_items AS (
    SELECT unnest(ARRAY[
      '2x Masala Dosa, 1x Tea',
      '1x Cold Coffee, 1x Brownie',
      '3x Samosa, 2x Buttermilk',
      '2x Maggi, 1x Lemon Tea',
      '1x Pav Bhaji, 1x Lassi',
      '2x Cappuccino, 1x Sandwich (Veg)',
      '1x Fried Rice, 1x Manchurian',
      '3x Bread Omelette, 2x Hot Coffee'
    ]) AS items_text,
    generate_series(1, 8) AS n
  ),
  pick_cost AS (
    SELECT unnest(ARRAY[115, 85, 115, 85, 80, 120, 115, 165]) AS estimated_cost,
           unnest(ARRAY[15, 20, 15, 10, 20, 25, 30, 15])      AS incentive,
           generate_series(1, 8) AS n
  ),
  pick_drop AS (
    SELECT id AS drop_location_id, name AS drop_location_name,
           ROW_NUMBER() OVER (ORDER BY name) AS n
    FROM drop_locations
    WHERE is_active = TRUE
    LIMIT 8
  ),
  pick_requester AS (
    SELECT uid AS requester_uid,
           ROW_NUMBER() OVER (ORDER BY random()) AS n
    FROM users
    WHERE is_active_pilot = FALSE
    LIMIT 8
  )
INSERT INTO orders (requester_uid, source, items_text, estimated_cost,
                    incentive, drop_location_id, drop_location_name,
                    floor_number, handover_otp, status)
SELECT
    r.requester_uid,
    s.source,
    i.items_text,
    c.estimated_cost,
    c.incentive,
    d.drop_location_id,
    d.drop_location_name,
    (ARRAY['G','1','2','3','4','5'])[1 + (s.n % 6)] AS floor_number,
    LPAD((1000 + (s.n * 137) % 9000)::text, 4, '0') AS handover_otp,
    'open'
FROM pick_source s
JOIN pick_items i     USING (n)
JOIN pick_cost c      USING (n)
JOIN pick_drop d      USING (n)
JOIN pick_requester r USING (n);

COMMIT;
