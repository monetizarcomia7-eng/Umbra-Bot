-- ============================================================
-- Umbra Bot — Tabela: alerts
-- Rota: /dashboard/alerts
-- ============================================================

create table if not exists public.alerts (
  id          uuid primary key default gen_random_uuid(),
  type        text not null
                check (type in (
                  'gateway_fail', 'bot_banned', 'bot_offline', 'send_quota',
                  'webhook_fail', 'payment_pending', 'limit_warning', 'ssl_expiring'
                )),
  severity    text          not null default 'warning'
                check (severity in ('critical', 'warning', 'info')),
  title       text          not null,
  description text          not null default '',
  context     jsonb         not null default '[]',
  resolved    boolean       not null default false,
  resolved_at timestamptz,
  resolved_by text,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create index if not exists alerts_resolved_idx   on public.alerts (resolved);
create index if not exists alerts_severity_idx   on public.alerts (severity);
create index if not exists alerts_created_at_idx on public.alerts (created_at desc);

create or replace trigger alerts_updated_at
  before update on public.alerts
  for each row execute function public.set_updated_at();

alter table public.alerts enable row level security;
drop policy if exists "alerts_open" on public.alerts;
create policy "alerts_open" on public.alerts for all using (true) with check (true);
