-- ============================================================
-- Umbra Bot — Remarketing: next_run_at + log de execuções
-- Migração 068
-- ============================================================

-- Adiciona next_run_at à tabela de campanhas
alter table public.remarketing_campaigns
  add column if not exists next_run_at timestamptz;

-- Tabela de log de execuções individuais por contato/etapa
create table if not exists public.remarketing_executions (
  id              uuid          primary key default gen_random_uuid(),
  campaign_id     uuid          not null references public.remarketing_campaigns(id) on delete cascade,
  user_id         uuid          not null references auth.users(id) on delete cascade,
  contact_id      uuid          references public.contacts(id) on delete set null,
  bot_id          uuid          references public.bots(id) on delete set null,
  step_index      integer       not null default 0,
  status          text          not null default 'pending'
                    check (status in ('pending', 'sent', 'failed', 'skipped')),
  message_sent    text,
  error_message   text,
  scheduled_at    timestamptz   not null default now(),
  executed_at     timestamptz,
  created_at      timestamptz   not null default now()
);

create index if not exists re_campaign_id_idx   on public.remarketing_executions (campaign_id);
create index if not exists re_user_id_idx       on public.remarketing_executions (user_id);
create index if not exists re_contact_id_idx    on public.remarketing_executions (contact_id);
create index if not exists re_status_sched_idx  on public.remarketing_executions (status, scheduled_at)
  where status = 'pending';

alter table public.remarketing_executions enable row level security;
create policy "re_owner" on public.remarketing_executions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
