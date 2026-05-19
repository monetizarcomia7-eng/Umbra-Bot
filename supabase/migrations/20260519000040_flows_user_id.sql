-- ============================================================
-- Umbra Bot — Flows: adiciona user_id e corrige RLS
--
-- Problema: a tabela flows não tinha coluna user_id, deixando
-- a RLS aberta (using (true)) — qualquer usuário autenticado
-- via Supabase SDK podia ler/modificar fluxos de outros.
--
-- Fix:
--   1. Adiciona user_id (FK → auth.users)
--   2. Índice para queries filtradas por usuário
--   3. Substitui policy "flows_open" por "flows_owner"
--
-- Nota: flows existentes com user_id NULL ficam inacessíveis
-- após esta migração (policy exige auth.uid() = user_id).
-- Como flows ainda não está implementado (feature em mock),
-- não há dados reais a preservar.
-- ============================================================

alter table public.flows
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists flows_user_id_idx
  on public.flows (user_id);

-- Substitui qualquer policy existente pela policy de owner
drop policy if exists "flows_open"  on public.flows;
drop policy if exists "flows_owner" on public.flows;

create policy "flows_owner" on public.flows
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
