-- Migration 102: flow_scheduled_sends
-- Armazena mensagens agendadas pelo nó Remarketing nos fluxos de venda.
-- Processado pelo cron /api/cron/process-remarketing a cada hora.

create table if not exists public.flow_scheduled_sends (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id)  on delete cascade,
  bot_id       uuid        not null references public.bots(id) on delete cascade,
  contact_id   uuid        not null references public.contacts(id) on delete cascade,
  chat_id      bigint      not null,
  message      text        not null,
  scheduled_at timestamptz not null,
  status       text        not null default 'pending'
                check (status in ('pending', 'sent', 'failed')),
  flow_id      uuid        references public.flows(id) on delete set null,
  error        text,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- Índice principal: busca eficiente das pendências no cron
create index if not exists fss_pending_scheduled_idx
  on public.flow_scheduled_sends (scheduled_at)
  where status = 'pending';

create index if not exists fss_user_id_idx   on public.flow_scheduled_sends (user_id);
create index if not exists fss_contact_id_idx on public.flow_scheduled_sends (contact_id);

-- RLS: usuário só lê os próprios registros (cron usa admin client, não precisa de select)
alter table public.flow_scheduled_sends enable row level security;

create policy "fss_owner"
  on public.flow_scheduled_sends
  for select
  using (auth.uid() = user_id);
