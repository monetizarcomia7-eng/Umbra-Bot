create table if not exists public.bank_accounts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  label      text        not null check (char_length(label) between 1 and 200),
  pix_key    text        not null check (char_length(pix_key) between 1 and 200),
  kind       text        not null default 'pix' check (kind in ('pix', 'conta', 'ted')),
  created_at timestamptz not null default now()
);

alter table bank_accounts enable row level security;

create policy "users manage own bank accounts"
  on bank_accounts for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
