-- ============================================================
-- 040_whatsapp_config_display_phone
--
-- The send path rejects a contact whose stored phone is in domestic
-- format (leading 0, e.g. Indonesian "087721603004") because Meta
-- requires E.164 ("6287721603004"). Contacts the webhook auto-creates
-- always store international format (Meta's `from`), but manually-added
-- and CSV-imported contacts can carry a domestic number — replying to
-- them 400s with "Invalid phone number format".
--
-- To internationalize such a number we need the account's country
-- code, which is the country of the account's OWN WhatsApp number.
-- This migration stores that number (Meta's `display_phone_number`,
-- international E.164) on whatsapp_config. It is populated from two
-- places that already have it for free:
--
--   1. the inbound webhook (`value.metadata.display_phone_number`),
--   2. the config save / health-check (Meta's phone-info response).
--
-- The send path then strips the leading 0 and prepends the derived
-- country code, and persists the corrected number back onto the
-- contact so the next send goes straight through.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS display_phone_number TEXT;

COMMENT ON COLUMN whatsapp_config.display_phone_number IS
  'The account''s WhatsApp business number in international E.164 form '
  '(e.g. 6281234567890), as reported by Meta. Used by the send path to '
  'internationalize contact numbers stored in domestic format (leading '
  '0). Populated by the inbound webhook and the config save/health '
  'check.';
