-- Fix drop_locations with correct NIT Goa coordinates.
-- Safe to run against a DB that already has orders: we preserve existing
-- drop_locations.id values by UPDATEing matched rows rather than deleting
-- them (orders.drop_location_id is a FK to drop_locations.id).
--
-- Strategy:
--   1. UPDATE rows whose old name matches the new name (case-insensitive)
--   2. INSERT the new locations that didn't exist before
--   3. Deactivate any old rows that no longer have a corresponding new entry,
--      so they don't show up in the picker but orders still resolve.

BEGIN;

-- 1. Update existing rows that map 1:1 by "close-enough" name
UPDATE drop_locations SET lat = 15.1710367, lng = 74.0147882,
    name = 'Talpona Hostel',
    description = 'Boys Hostel - Talpona Block near lift'
    WHERE LOWER(name) IN ('talpona lift', 'talpona hostel');

UPDATE drop_locations SET lat = 15.1697763, lng = 74.0121135,
    name = 'Terekhol Hostel',
    description = 'Girls Hostel - Terekhol Block near lift'
    WHERE LOWER(name) IN ('terekhol lift', 'terekhol hostel');

UPDATE drop_locations SET lat = 15.1697079, lng = 74.0127932,
    name = 'Mechanical Dept',
    description = 'Mechanical Engineering Department entrance'
    WHERE LOWER(name) IN ('mechanical department', 'mechanical dept');

UPDATE drop_locations SET lat = 15.1686770, lng = 74.0127808,
    name = 'ECE Dept',
    description = 'Electronics & Communication Department entrance'
    WHERE LOWER(name) IN ('ece department', 'ece dept');

UPDATE drop_locations SET lat = 15.1686770, lng = 74.0127808,
    name = 'CSE Dept',
    description = 'Computer Science Department entrance'
    WHERE LOWER(name) IN ('cse department', 'cse dept');

UPDATE drop_locations SET lat = 15.1693565, lng = 74.0122595,
    name = 'Library Block',
    description = 'Central Library main entrance'
    WHERE LOWER(name) IN ('library', 'library block');

-- 2. Insert new locations that didn't exist in the old seed
INSERT INTO drop_locations (name, description, lat, lng)
SELECT 'Civil Dept', 'Civil Engineering Department entrance', 15.1695920, 74.0134207
WHERE NOT EXISTS (SELECT 1 FROM drop_locations WHERE LOWER(name) = 'civil dept');

INSERT INTO drop_locations (name, description, lat, lng)
SELECT 'Gyan Mandir', 'Gyan Mandir academic block', 15.1690189, 74.0117258
WHERE NOT EXISTS (SELECT 1 FROM drop_locations WHERE LOWER(name) = 'gyan mandir');

-- 3. Deactivate anything we didn't touch (keeps FK integrity for historical orders)
UPDATE drop_locations SET is_active = FALSE
WHERE LOWER(name) NOT IN (
    'talpona hostel', 'terekhol hostel', 'mechanical dept', 'civil dept',
    'ece dept', 'cse dept', 'library block', 'gyan mandir'
);

COMMIT;
