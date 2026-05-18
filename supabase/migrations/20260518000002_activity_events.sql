-- ============================================================
-- Umbra Bot — Tabela: activity_events
-- Rota: /dashboard/activity
-- ============================================================

create table if not exists public.activity_events (
  id          uuid primary key default gen_random_uuid(),
  type        text not null
                check (type in (
                  'sale', 'new_lead', 'checkout', 'bot_online', 'bot_offline',
                  'refund', 'webhook', 'flow', 'block', 'affiliate_join',
                  'broadcast', 'payment_fail'
                )),
  title       text          not null,
  description text          not null default '',
  bot         text          not null default '',
  amount      numeric(12,2),
  created_at  timestamptz   not null default now()
);

create index if not exists activity_events_created_at_idx on public.activity_events (created_at desc);
create index if not exists activity_events_type_idx       on public.activity_events (type);
create index if not exists activity_events_bot_idx        on public.activity_events (bot);

alter table public.activity_events enable row level security;
drop policy if exists "activity_events_open" on public.activity_events;
create policy "activity_events_open" on public.activity_events for all using (true) with check (true);
