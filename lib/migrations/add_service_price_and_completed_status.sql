-- Migration: Add service_price to bookings and update status constraint
-- Date: 2026-02-09

-- 1. Add service_price column to bookings table
ALTER TABLE bookings
ADD COLUMN service_price numeric(10, 2);

-- 2. Drop old status constraint
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_status_check;

-- 3. Add new status constraint including 'completed'
ALTER TABLE bookings
ADD CONSTRAINT bookings_status_check
CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text]));

-- 4. Backfill service_price for existing bookings (optional - comment out if not needed)
-- UPDATE bookings b
-- SET service_price = s.price
-- FROM services s
-- WHERE b.service_id = s.id AND b.service_price IS NULL;

-- 5. Add index for commission reports (improves query performance)
CREATE INDEX IF NOT EXISTS idx_bookings_professional_date_status
ON bookings (professional_id, date, status);

-- Note: To run this migration, execute:
-- psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f lib/migrations/add_service_price_and_completed_status.sql
