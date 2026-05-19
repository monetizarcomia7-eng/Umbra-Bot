-- ============================================================
-- Umbra Bot — Tabela: transactions
-- Rota: /api/payments/pix, /dashboard/finance
-- ============================================================

create table if not exists public.transactions (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users(id) on delete cascade,
  bot_id                uuid,
  gateway               text        not null default 'mercadopago',
  gateway_payment_id    text,
  amount                numeric(12,2) not null,
  net                   numeric(12,2),
  fee                   numeric(12,2) not null default 0,
  status                text        not null default 'pending'
                          check (status in ('pending','approved','cancelled','refunded')),
  pix_qr_code           text,
  pix_copy_paste        text,
  pix_expires_at        timestamptz,
  product_name          text        not null default '',
  customer_name         text        not null default '',
  customer_email        text        not null default '',
  customer_cpf          text,
  customer_telegram_id  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists transactions_user_id_idx    on public.transactions (user_id);
create index if not exists transactions_status_idx     on public.transactions (status);
create index if not exists transactions_created_at_idx on public.transactions (created_at desc);
create index if not exists transactions_gateway_id_idx on public.transactions (gateway_payment_id);

create or replace trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

create policy "transactions_owner" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
