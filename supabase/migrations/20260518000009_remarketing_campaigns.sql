-- ============================================================
-- Umbra Bot — Tabela: remarketing_campaigns
-- Rota: /dashboard/remarketing
-- ============================================================

create table if not exists public.remarketing_campaigns (
  id                uuid          primary key default gen_random_uuid(),
  name              text          not null,
  description       text          not null default '',
  trigger_type      text          not null default 'carrinho_abandonado',
  audience          text          not null default 'all',
  trigger_config    jsonb         not null default '{}',
  status            text          not null default 'draft'
                      check (status in ('active', 'paused', 'draft', 'finished')),
  leads_recovered   integer       not null default 0,
  revenue_recovered numeric(12,2) not null default 0,
  leads_triggered   integer       not null default 0,
  conversion        numeric(5,2)  not null default 0,
  steps             jsonb         not null default '[]',
  step_stats        jsonb         not null default '[]',
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create index if not exists remarketing_status_idx     on public.remarketing_campaigns (status);
create index if not exists remarketing_trigger_idx    on public.remarketing_campaigns (trigger_type);
create index if not exists remarketing_updated_at_idx on public.remarketing_campaigns (updated_at desc);

create or replace trigger remarketing_campaigns_updated_at
  before update on public.remarketing_campaigns
  for each row execute function public.set_updated_at();

alter table public.remarketing_campaigns enable row level security;
drop policy if exists "remarketing_campaigns_open" on public.remarketing_campaigns;
create policy "remarketing_campaigns_open" on public.remarketing_campaigns for all using (true) with check (true);
