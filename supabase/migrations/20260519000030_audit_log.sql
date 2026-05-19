-- ============================================================
-- Umbra Bot — Tabela de auditoria (audit_log)
--
-- Registra ações críticas: saques, mudanças de status, acesso admin.
-- Escrita feita pelo backend via service role (sem RLS de insert).
-- Leitura restrita ao próprio usuário.
-- ============================================================

create table if not exists public.audit_log (
  id          bigserial     primary key,
  user_id     uuid          references auth.users(id) on delete set null,
  action      text          not null,
  table_name  text,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz   not null default now()
);

-- Índices para lookup por usuário e por tempo
create index if not exists audit_log_user_id_idx    on public.audit_log (user_id, created_at desc);
create index if not exists audit_log_action_idx     on public.audit_log (action);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

-- Cada usuário lê apenas seus próprios registros
create policy "audit_log_self_select" on public.audit_log
  for select using (auth.uid() = user_id);

-- Insert apenas via service role (sem policy de insert para roles normais)
-- O backend usa createClient() no servidor, que tem permissões adequadas.
