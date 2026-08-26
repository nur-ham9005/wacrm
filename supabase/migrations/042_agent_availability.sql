-- ============================================================
-- Per-agent availability + capacity for fair round-robin routing.
--
-- Adds two columns to `profiles` so an owner/admin can mark an agent
-- as on-leave and cap how many open conversations they hold at once:
--
--   is_available     — false = on leave / off duty; the round-robin
--                      resolver skips them entirely.
--   max_concurrent   — maximum open (non-closed) conversations the
--                      agent may be auto-assigned; the resolver skips
--                      an agent once they reach this ceiling.
--
-- Defaults keep existing behaviour: everyone available, cap of 2.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_concurrent INTEGER NOT NULL DEFAULT 2;
