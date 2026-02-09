-- Migration: Create professional_work_hours table
-- Date: 2026-02-09
-- Purpose: Allow each professional to have custom work hours per day of week

-- Create professional_work_hours table
CREATE TABLE professional_work_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL,
  day_of_week integer NOT NULL, -- 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamp with time zone DEFAULT now(),

  CONSTRAINT fk_professional_work_hours
    FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE,

  CONSTRAINT valid_day_of_week
    CHECK (day_of_week >= 0 AND day_of_week <= 6),

  CONSTRAINT valid_time_range
    CHECK (start_time < end_time)
);

-- Create indexes for better query performance
CREATE INDEX idx_work_hours_professional ON professional_work_hours (professional_id);
CREATE INDEX idx_work_hours_day ON professional_work_hours (professional_id, day_of_week);

-- Example data: Barbeiro Samuel
-- Segunda a Sexta (1-5): 14:00-20:00
-- Sábado (6): 09:00-12:00 e 14:00-20:00
-- Domingo (0): Não trabalha (sem registros)

-- Uncomment below to insert example data for a professional:
/*
INSERT INTO professional_work_hours (professional_id, day_of_week, start_time, end_time)
VALUES
  -- Monday to Friday (14:00-20:00)
  ('YOUR_PROFESSIONAL_UUID', 1, '14:00', '20:00'),
  ('YOUR_PROFESSIONAL_UUID', 2, '14:00', '20:00'),
  ('YOUR_PROFESSIONAL_UUID', 3, '14:00', '20:00'),
  ('YOUR_PROFESSIONAL_UUID', 4, '14:00', '20:00'),
  ('YOUR_PROFESSIONAL_UUID', 5, '14:00', '20:00'),
  -- Saturday (09:00-12:00 AND 14:00-20:00) - Two periods
  ('YOUR_PROFESSIONAL_UUID', 6, '09:00', '12:00'),
  ('YOUR_PROFESSIONAL_UUID', 6, '14:00', '20:00');
*/

-- Note: To run this migration, execute:
-- psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f lib/migrations/create_professional_work_hours.sql
