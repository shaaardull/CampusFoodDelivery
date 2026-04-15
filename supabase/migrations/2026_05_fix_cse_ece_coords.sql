-- Fix CSE Dept / ECE Dept drop-location coordinates.
--
-- The prior seed/migration put CSE and ECE at the exact same lat/lng
-- (15.168677, 74.0127808), which made the CSE marker land on ECE on the
-- tracking map. These are the correct on-campus coords.

BEGIN;

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

COMMIT;
