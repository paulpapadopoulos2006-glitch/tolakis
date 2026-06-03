-- ═══════════════════════════════════════════════════════════════════
--  KAP HOME — Migration script for existing databases
--  Run this in: Supabase Dashboard → SQL Editor → New query
--  Safe to run multiple times (uses IF EXISTS / IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════

-- ── Fix 1: blocked_dates — change UNIQUE(date) to UNIQUE(date, reason) ──
-- The old schema had a unique constraint on just the date column.
-- This caused iCal sync to fail whenever Airbnb/Booking.com blocked a date
-- that was already manually blocked (or vice-versa).
-- The fix allows the same date to be blocked by multiple sources at once.

ALTER TABLE blocked_dates
  DROP CONSTRAINT IF EXISTS blocked_dates_date_key;

ALTER TABLE blocked_dates
  ADD CONSTRAINT unique_date_reason UNIQUE (date, reason);

-- ── Fix 2: Create date_overrides table (enables custom date pricing) ──

CREATE TABLE IF NOT EXISTS date_overrides (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  nightly_rate NUMERIC(10,2) NOT NULL,
  label        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

ALTER TABLE date_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'date_overrides' AND policyname = 'public_read_overrides'
  ) THEN
    CREATE POLICY "public_read_overrides" ON date_overrides FOR SELECT USING (true);
  END IF;
END $$;
