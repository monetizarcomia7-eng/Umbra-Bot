-- ============================================================
-- Umbra Bot — Migration 071: Broadcasts — melhorias
--
-- 1. RLS: substitui "broadcasts_open" (anyone=true) por "broadcasts_owner"
--    (P0 — qualquer usuário autenticado podia ver/editar disparos alheios)
-- 2. Índice user_id para performance do RLS
-- 3. CHECK na coluna audience (valores válidos)
-- 4. RPC broadcasts_audience_counts agora aceita p_bot_id opcional
--    → quando informado, conta apenas contatos desse bot
-- ============================================================

-- 1. Fix RLS (P0 security)
DROP POLICY IF EXISTS "broadcasts_open"  ON public.broadcasts;
DROP POLICY IF EXISTS "broadcasts_owner" ON public.broadcasts;
CREATE POLICY "broadcasts_owner" ON public.broadcasts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Índice user_id (melhora performance do RLS filter)
CREATE INDEX IF NOT EXISTS broadcasts_user_id_idx
  ON public.broadcasts (user_id);

-- 3. CHECK na coluna audience
ALTER TABLE public.broadcasts
  DROP CONSTRAINT IF EXISTS broadcasts_audience_check;
ALTER TABLE public.broadcasts
  ADD CONSTRAINT broadcasts_audience_check
  CHECK (audience IN ('all','leads','buyers') OR audience LIKE 'tag:%');

-- 4. RPC com p_bot_id opcional
-- Quando p_bot_id é informado, conta apenas contatos daquele bot.
-- Isso permite mostrar contagens precisas no editor ao trocar de bot.
CREATE OR REPLACE FUNCTION public.broadcasts_audience_counts(
  p_user_id uuid,
  p_bot_id  uuid DEFAULT NULL
)
RETURNS json
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT json_build_object(
    'all',    (
      SELECT count(*)::bigint
      FROM contacts
      WHERE user_id = p_user_id
        AND telegram_id IS NOT NULL
        AND (p_bot_id IS NULL OR bot_id = p_bot_id)
    ),
    'leads',  (
      SELECT count(*)::bigint
      FROM contacts
      WHERE user_id = p_user_id
        AND telegram_id IS NOT NULL
        AND (p_bot_id IS NULL OR bot_id = p_bot_id)
        AND coalesce(orders_count, 0) = 0
    ),
    'buyers', (
      SELECT count(*)::bigint
      FROM contacts
      WHERE user_id = p_user_id
        AND telegram_id IS NOT NULL
        AND (p_bot_id IS NULL OR bot_id = p_bot_id)
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
              AND (p_bot_id IS NULL OR bot_id = p_bot_id)
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

GRANT EXECUTE ON FUNCTION public.broadcasts_audience_counts(uuid, uuid) TO authenticated;
