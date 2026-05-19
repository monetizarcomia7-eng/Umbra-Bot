-- ============================================================
-- Umbra Bot — Índice composto em transactions(user_id, status, created_at)
--
-- As queries mais frequentes filtram pelos 3 campos juntos:
--   .eq('user_id', x).eq('status', 'approved').gte('created_at', since)
-- O índice composto elimina seq scans e ordena já pelo campo de range.
-- ============================================================

create index if not exists transactions_user_status_created_idx
  on public.transactions (user_id, status, created_at desc);
