-- Migration 100: Bots improvements
-- Adds bot_id FK column to alerts table so check-bots cron can filter alerts by bot
-- Also adds welcome_message and fallback_message columns if missing (defensive)

-- 1. Add bot_id to alerts (allows filtering alerts per-bot in check-bots cron)
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS bot_id uuid REFERENCES public.bots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS alerts_bot_id_idx
  ON public.alerts(bot_id)
  WHERE bot_id IS NOT NULL;

-- 2. Ensure welcome_message and fallback_message exist on bots table
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS welcome_message  text,
  ADD COLUMN IF NOT EXISTS fallback_message text;
