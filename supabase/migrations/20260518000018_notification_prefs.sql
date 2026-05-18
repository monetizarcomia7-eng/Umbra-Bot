-- ============================================================
-- Umbra Bot — Tabela: notification_prefs
-- Rota: /dashboard/notifications
-- ============================================================

create table if not exists public.notification_prefs (
  id            text        primary key default gen_random_uuid()::text,
  prefs         jsonb       not null default '{}',
  channel_state jsonb       not null default '{"email":{"linked":true},"panel":{"linked":true},"telegram":{"linked":false}}',
  quiet         jsonb       not null default '{"enabled":true,"from":"22:00","to":"07:00","exceptCritical":true}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists notification_prefs_updated_at_idx on public.notification_prefs (updated_at desc);

create or replace trigger notification_prefs_updated_at
  before update on public.notification_prefs
  for each row execute function public.set_updated_at();

alter table public.notification_prefs enable row level security;
drop policy if exists "notification_prefs_open" on public.notification_prefs;
create policy "notification_prefs_open" on public.notification_prefs for all using (true) with check (true);
