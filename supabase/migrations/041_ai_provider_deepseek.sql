-- ============================================================
-- 041_ai_provider_deepseek
--
-- Add DeepSeek as a supported bring-your-own-key provider for the AI
-- assistant. DeepSeek exposes an OpenAI-compatible Chat Completions
-- API, so the adapter in src/lib/ai/providers/deepseek.ts shares the
-- OpenAI envelope; only the DB CHECK constraint needs widening here.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE ai_configs
  DROP CONSTRAINT IF EXISTS ai_configs_provider_check;

ALTER TABLE ai_configs
  ADD CONSTRAINT ai_configs_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'deepseek'));
