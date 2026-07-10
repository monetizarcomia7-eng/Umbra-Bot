-- ─────────────────────────────────────────────────────────────────────────────
-- Migração 115 — Canais/grupos onde o bot é administrador (bot_channels)
--
-- Permite conectar, no editor de fluxos, o canal/grupo onde o bot do fluxo é admin,
-- para o nó Entregável (modo convite) gerar convites de uso único automaticamente.
--
-- Como a tabela é populada:
--   1. Automático: o webhook recebe o evento `my_chat_member` quando o bot é
--      promovido/rebaixado como admin e faz upsert aqui.
--   2. Manual: o server action connectBotChannelAction() valida via getChat +
--      getChatMember que o bot é admin e faz upsert aqui.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.bot_channels (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  bot_id      uuid        not null references public.bots(id) on delete cascade,
  chat_id     text        not null,                 -- id do canal/grupo (ex.: -1001234567890)
  title       text,
  username    text,                                 -- @username quando público
  type        text,                                 -- 'channel' | 'supergroup' | 'group'
  is_admin    boolean     not null default true,    -- false quando o bot é rebaixado/removido
  can_invite  boolean     not null default true,    -- permissão de convidar (gera invite link)
  added_at    timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (bot_id, chat_id)
);

alter table public.bot_channels enable row level security;

drop policy if exists "bot_channels_owner" on public.bot_channels;
create policy "bot_channels_owner" on public.bot_channels
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists bot_channels_bot_admin_idx
  on public.bot_channels (bot_id) where is_admin;

-- Mantém updated_at (usa o set_updated_at() já existente no schema).
drop trigger if exists bot_channels_updated_at on public.bot_channels;
create trigger bot_channels_updated_at
  before update on public.bot_channels
  for each row execute function public.set_updated_at();
