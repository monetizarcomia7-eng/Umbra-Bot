create table if not exists public.withdrawals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  amount          numeric(12, 2) not null check (amount > 0),
  account_id      text not null,
  account_label   text not null,
  status          text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at      timestamptz not null default now(),
  concluded_at    timestamptz
);

alter table public.withdrawals enable row level security;

create policy "users can view own withdrawals"
  on public.withdrawals for select
  using (auth.uid() = user_id);

create policy "users can insert own withdrawals"
  on public.withdrawals for insert
  with check (auth.uid() = user_id);
