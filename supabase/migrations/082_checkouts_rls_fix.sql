-- Migration 082: corrige RLS da tabela checkouts
-- A política anterior "checkouts_open" usava using(true) — qualquer usuário autenticado
-- via Supabase SDK / REST podia ler e modificar checkouts de outros usuários (IDOR crítico).
-- Fix: substitui por política owner usando auth.uid() = user_id.
-- Nota: checkouts.user_id é uuid (como auth.uid()), sem cast necessário.
--       É checkouts.id que é text, mas ele não entra nesta comparação.

drop policy if exists "checkouts_open"  on public.checkouts;
drop policy if exists "checkouts_owner" on public.checkouts;

create policy "checkouts_owner" on public.checkouts
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Índice para acelerar queries filtradas por user_id (se ainda não existir)
create index if not exists checkouts_user_id_idx on public.checkouts (user_id);
