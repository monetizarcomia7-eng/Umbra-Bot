-- ============================================================
-- Umbra Bot — Tabela: contacts
-- Rota: /dashboard/customers
-- ============================================================

create table if not exists public.contacts (
  id              uuid primary key default gen_random_uuid(),
  name            text          not null,
  telegram_id     text,
  phone           text,
  email           text,
  bot             text,
  status          text          not null default 'new'
                    check (status in ('new', 'active', 'vip', 'inactive', 'blocked')),
  tags            text[]        not null default '{}',
  total_spent     numeric(12,2) not null default 0,
  orders_count    integer       not null default 0,
  city            text,
  state           text,
  first_contact   timestamptz   not null default now(),
  last_contact    timestamptz   not null default now(),
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create index if not exists contacts_status_idx       on public.contacts (status);
create index if not exists contacts_last_contact_idx on public.contacts (last_contact desc);
create index if not exists contacts_tags_idx         on public.contacts using gin (tags);
create index if not exists contacts_telegram_id_idx  on public.contacts (telegram_id);

create or replace trigger contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

alter table public.contacts enable row level security;
drop policy if exists "contacts_open" on public.contacts;
create policy "contacts_open" on public.contacts for all using (true) with check (true);
