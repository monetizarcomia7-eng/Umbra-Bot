-- ============================================================
-- Umbra Bot — Migração 121: Automações de comentário → DM (Instagram)
-- ============================================================
-- Quando alguém comenta uma palavra-chave num post/Reels, o webhook responde o comentário
-- (opcional) e envia uma DM (resposta privada) com botões.
-- Fluxo: comentário → DM 1 (botão) → clique → [exigir seguir?] → DM final com link.
-- ============================================================

create table if not exists public.instagram_automations (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  account_id          uuid        not null references public.instagram_accounts(id) on delete cascade,
  name                text        not null,
  media_id            text,                                   -- null = qualquer publicação da conta
  media_label         text,                                   -- legenda resumida (só exibição)
  keywords            text[]      not null,
  match_type          text        not null default 'contains' check (match_type in ('contains', 'exact')),
  reply_comment_text  text,                                   -- resposta pública (null = não responde)
  dm_text             text        not null,
  dm_button_label     text,                                   -- null = DM 1 já entrega os botões de link
  final_text          text,
  final_buttons       jsonb       not null default '[]',      -- [{ "title": "...", "url": "https://..." }] (máx 3)
  require_follow      boolean     not null default false,
  follow_text         text,
  follow_button_label text,
  is_active           boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint ig_auto_keywords_chk check (cardinality(keywords) between 1 and 10),
  constraint ig_auto_dm_len_chk   check (char_length(dm_text) <= 640),
  constraint ig_auto_buttons_chk  check (jsonb_typeof(final_buttons) = 'array' and jsonb_array_length(final_buttons) <= 3)
);

create index if not exists ig_auto_user_idx    on public.instagram_automations (user_id);
create index if not exists ig_auto_account_idx on public.instagram_automations (account_id) where is_active = true;

alter table public.instagram_automations enable row level security;
drop policy if exists "ig_auto_owner" on public.instagram_automations;
create policy "ig_auto_owner" on public.instagram_automations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Log de execuções. dedupe_key UNIQUE evita DM duplicada quando a Meta reenvia o webhook
-- ('c:<comment_id>' para comentários, 'p:<mid>' para cliques em botão).
create table if not exists public.instagram_automation_events (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  automation_id  uuid        not null references public.instagram_automations(id) on delete cascade,
  kind           text        not null check (kind in ('comment', 'click')),
  dedupe_key     text        not null unique,
  comment_id     text,
  ig_sender_id   text,
  username       text,
  status         text        not null default 'processing'
                   check (status in ('processing', 'sent', 'delivered', 'gated', 'skipped', 'failed')),
  error_msg      text,
  created_at     timestamptz not null default now()
);

create index if not exists ig_auto_ev_auto_idx on public.instagram_automation_events (automation_id, created_at desc);
create index if not exists ig_auto_ev_user_idx on public.instagram_automation_events (user_id, created_at desc);

alter table public.instagram_automation_events enable row level security;
drop policy if exists "ig_auto_ev_owner_select" on public.instagram_automation_events;
create policy "ig_auto_ev_owner_select" on public.instagram_automation_events
  for select using (auth.uid() = user_id);
-- Escrita só via service role (webhook).

-- Estatísticas por automação (últimos 30 dias)
create or replace function public.instagram_automation_stats(p_user_id uuid)
returns table (automation_id uuid, sent bigint, clicked bigint, delivered bigint, failed bigint)
language sql stable security invoker set search_path = public
as $$
  select
    automation_id,
    count(*) filter (where kind = 'comment' and status = 'sent'),
    count(*) filter (where kind = 'click'),
    count(*) filter (where kind = 'click' and status = 'delivered'),
    count(*) filter (where status = 'failed')
  from public.instagram_automation_events
  where user_id = p_user_id
    and created_at >= now() - interval '30 days'
  group by automation_id;
$$;
grant execute on function public.instagram_automation_stats(uuid) to authenticated;
