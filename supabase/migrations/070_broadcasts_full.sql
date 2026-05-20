-- ============================================================
-- Umbra Bot — Migration 070: Broadcasts — fix completo
--
-- 1. Força user_id NOT NULL (apaga órfãos sem dono)
-- 2. RPC broadcasts_audience_counts: contagens reais por público
-- 3. Garante índice user_id+status para cron
-- ============================================================

-- Remove broadcasts sem usuário (dados de teste)
DELETE FROM public.broadcasts WHERE user_id IS NULL;

-- Enforce NOT NULL agora que a coluna existe e está limpa
ALTER TABLE public.broadcasts ALTER COLUMN user_id SET NOT NULL;

-- Índice composto para cron (scheduled + scheduled_for)
CREATE INDEX IF NOT EXISTS broadcasts_scheduled_idx
  ON public.broadcasts (status, scheduled_for)
  WHERE status = 'scheduled';

-- ── RPC: contagens de audiência por usuário ─────────────────
-- Retorna: { all, leads, buyers, tags: { "VIP": 287, ... } }
-- Usado pelo Server Component da página Disparador
CREATE OR REPLACE FUNCTION public.broadcasts_audience_counts(p_user_id uuid)
RETURNS json
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT json_build_object(
    'all',    (
      SELECT count(*)::bigint
      FROM contacts
      WHERE user_id = p_user_id AND telegram_id IS NOT NULL
    ),
    'leads',  (
      SELECT count(*)::bigint
      FROM contacts
      WHERE user_id = p_user_id
        AND telegram_id IS NOT NULL
        AND coalesce(orders_count, 0) = 0
    ),
    'buyers', (
      SELECT count(*)::bigint
      FROM contacts
      WHERE user_id = p_user_id
        AND telegram_id IS NOT NULL
        AND coalesce(orders_count, 0) > 0
    ),
    'tags', (
      SELECT coalesce(
        (
          SELECT json_object_agg(tag, cnt)
          FROM (
            SELECT unnest(tags) AS tag, count(*)::bigint AS cnt
            FROM contacts
            WHERE user_id = p_user_id
              AND telegram_id IS NOT NULL
              AND tags IS NOT NULL
              AND array_length(tags, 1) > 0
            GROUP BY tag
            ORDER BY cnt DESC
            LIMIT 20
          ) t
        ),
        '{}'::json
      )
    )
  )
$$;

GRANT EXECUTE ON FUNCTION public.broadcasts_audience_counts(uuid) TO authenticated;
