-- ============================================================
-- Umbra Bot — Tabela: checkouts
-- Rota: /dashboard/checkout
-- ============================================================

create table if not exists public.checkouts (
  id            text          primary key,
  name          text          not null,
  slug          text          not null unique,
  product_name  text          not null default '',
  product_desc  text          not null default '',
  price         numeric(12,2) not null default 0,
  installments  integer       not null default 1,
  gateway       text          not null default 'pushinpay',
  pixel         text          not null default 'none',
  primary_color text          not null default '#7c3aed',
  bg_variant    text          not null default 'light'
                  check (bg_variant in ('light', 'dark')),
  font          text          not null default 'Inter',
  logo          text          not null default '',
  badge         text,
  fields        jsonb         not null default '{"name":true,"email":true,"cpf":false,"phone":false,"address":false,"cep":false}',
  methods       jsonb         not null default '{"pix":true,"card":true,"boleto":false}',
  layout        text          not null default 'two_col'
                  check (layout in ('two_col', 'one_col')),
  status        text          not null default 'draft'
                  check (status in ('published', 'draft', 'archived')),
  visits        integer       not null default 0,
  conversions   integer       not null default 0,
  conversion    numeric(5,2)  not null default 0,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

create index if not exists checkouts_status_idx     on public.checkouts (status);
create index if not exists checkouts_slug_idx       on public.checkouts (slug);
create index if not exists checkouts_updated_at_idx on public.checkouts (updated_at desc);

create or replace trigger checkouts_updated_at
  before update on public.checkouts
  for each row execute function public.set_updated_at();

alter table public.checkouts enable row level security;
drop policy if exists "checkouts_open" on public.checkouts;
create policy "checkouts_open" on public.checkouts for all using (true) with check (true);
