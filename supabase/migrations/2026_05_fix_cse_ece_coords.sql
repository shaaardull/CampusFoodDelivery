-- Fix drop-location coordinates (Mechanical / CSE / ECE / Library / Talpona / Terekhol).
--
-- The prior seed/migration put CSE and ECE at the exact same lat/lng
-- (15.168677, 74.0127808), which made the CSE marker land on ECE on the
-- tracking map. The Library / Mechanical / Talpona / Terekhol coords were
-- also off. These are the correct on-campus coords.
--
-- Idempotent: safe to re-run if partially applied.

BEGIN;

UPDATE drop_locations
SET lat = 15.169770,
    lng = 74.014119,
    description = 'Mechanical Engineering Department entrance'
WHERE LOWER(name) IN ('mechanical dept', 'mechanical department');

UPDATE drop_locations
SET lat = 15.168814,
    lng = 74.012959,
    description = 'Electronics & Communication Department entrance'
WHERE LOWER(name) IN ('ece dept', 'ece department');

UPDATE drop_locations
SET lat = 15.168811,
    lng = 74.013550,
    description = 'Computer Science Department entrance'
WHERE LOWER(name) IN ('cse dept', 'cse department');

UPDATE drop_locations
SET lat = 15.169233,
    lng = 74.012713,
    description = 'Central Library main entrance'
WHERE LOWER(name) IN ('library', 'library block');

UPDATE drop_locations
SET lat = 15.171168,
    lng = 74.015692,
    description = 'Boys Hostel - Talpona Block near lift'
WHERE LOWER(name) IN ('talpona hostel', 'talpona lift');

UPDATE drop_locations
SET lat = 15.170016,
    lng = 74.012100,
    description = 'Girls Hostel - Terekhol Block near lift'
WHERE LOWER(name) IN ('terekhol hostel', 'terekhol lift');

COMMIT;
