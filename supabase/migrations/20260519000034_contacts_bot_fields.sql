-- ============================================================
-- Umbra Bot — Contacts: adiciona campos de bot e perfil Telegram
--
-- O webhook do Telegram faz upsert com bot_id, first_name, last_name,
-- username e language, mas esses campos não existiam.
-- Também adiciona 'purchases' como alias de orders_count para
-- compatibilidade com o broadcast/send route.
-- ============================================================

alter table public.contacts
  add column if not exists bot_id     uuid references public.bots(id) on delete set null,
  add column if not exists first_name text not null default '',
  add column if not exists last_name  text not null default '',
  add column if not exists username   text,
  add column if not exists language   text not null default 'pt',
  add column if not exists purchases  integer not null default 0;

-- Mantém purchases em sincronia com orders_count (coluna legada)
create or replace function public.sync_purchases()
returns trigger language plpgsql as $$
begin
  if new.orders_count <> old.orders_count then
    new.purchases := new.orders_count;
  elsif new.purchases <> old.purchases then
    new.orders_count := new.purchases;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_purchases on public.contacts;
create trigger trg_sync_purchases
  before update on public.contacts
  for each row execute function public.sync_purchases();

-- Dá default vazio ao name para que o upsert do webhook não falhe
alter table public.contacts alter column name set default '';

-- Unique constraint para o upsert bot_id,telegram_id do webhook
create unique index if not exists contacts_bot_telegram_udx
  on public.contacts (bot_id, telegram_id)
  where bot_id is not null and telegram_id is not null;

create index if not exists contacts_bot_id_idx on public.contacts (bot_id);
