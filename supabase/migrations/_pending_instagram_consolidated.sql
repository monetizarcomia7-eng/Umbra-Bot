-- ============================================================
-- Umbra Bot — Migração consolidada do módulo Instagram Scheduler
-- ============================================================
-- Pode ser executada num banco zerado ou idempotentemente sobre um
-- banco que já rodou as migrações 106/107 (tudo é IF NOT EXISTS / OR REPLACE).
--
-- Cobre as 3 tabelas pedidas:
--   1. instagram_accounts     ← contas conectadas
--   2. instagram_posts        ← posts agendados (era "scheduled_posts" na sua spec)
--   3. instagram_publish_logs ← histórico de tentativas (era "publish_logs" na sua spec)
--
-- ATENÇÃO: os nomes das tabelas SÃO instagram_posts e instagram_publish_logs.
-- Não use scheduled_posts / publish_logs — todo o código do projeto
-- (lib/instagram, app/actions/instagram.ts, crons) depende desses nomes.
--
-- Como aplicar:
--   Supabase Dashboard → SQL Editor → New query → cole tudo → Run
-- ============================================================

-- ─── Pré-requisitos ───────────────────────────────────────────
-- Função set_updated_at usada pelos triggers (criada pela migração base 000).
-- Recriada aqui defensivamente para garantir que o script rode standalone.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- TABELA 1: instagram_accounts
-- ============================================================
-- Contas Instagram Business conectadas via OAuth Meta.
-- Tokens criptografados AES-256-GCM via lib/crypto (prefixo `enc:`).
create table if not exists public.instagram_accounts (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  ig_user_id        text        not null,                    -- ID da conta no Instagram
  username          text,                                    -- @username
  profile_picture   text,                                    -- URL da foto
  access_token      text        not null,                    -- token IG (criptografado)
  token_expires_at  timestamptz,                             -- expiração do token (~60 dias)
  page_id           text,                                    -- Facebook Page vinculada
  page_token        text,                                    -- token da page (criptografado)
  is_active         boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, ig_user_id)
);

create index if not exists ig_accounts_user_id_idx
  on public.instagram_accounts (user_id);

create index if not exists ig_accounts_token_expires_idx
  on public.instagram_accounts (token_expires_at)
  where is_active = true;

alter table public.instagram_accounts enable row level security;

drop policy if exists "ig_accounts_owner" on public.instagram_accounts;
create policy "ig_accounts_owner" on public.instagram_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- TABELA 2: instagram_posts
-- ============================================================
-- Posts agendados (IMAGE / REELS / CAROUSEL).
-- O cron /api/cron/publish-instagram processa WHERE status='scheduled'.
create table if not exists public.instagram_posts (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  account_id    uuid        not null references public.instagram_accounts(id) on delete cascade,
  media_type    text        not null
                  check (media_type in ('IMAGE', 'REELS', 'CAROUSEL')),
  media_urls    text[]      not null,
  caption       text        not null default '',
  scheduled_at  timestamptz not null,
  status        text        not null default 'scheduled'
                  check (status in ('draft','scheduled','publishing','published','failed','cancelled')),
  ig_post_id    text,                                       -- ID após publicado no IG
  published_at  timestamptz,
  error_msg     text,
  retry_count   integer     not null default 0,
  max_retries   integer     not null default 3,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Índice parcial principal — usado pelo cron worker (busca pendentes)
create index if not exists ig_posts_cron_idx
  on public.instagram_posts (scheduled_at, status)
  where status = 'scheduled';

create index if not exists ig_posts_user_id_idx
  on public.instagram_posts (user_id, created_at desc);

create index if not exists ig_posts_account_id_idx
  on public.instagram_posts (account_id, created_at desc);

alter table public.instagram_posts enable row level security;

drop policy if exists "ig_posts_owner" on public.instagram_posts;
create policy "ig_posts_owner" on public.instagram_posts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- TABELA 3: instagram_publish_logs
-- ============================================================
-- Log detalhado de cada tentativa de publicação (auditoria + debug).
-- TTL 30 dias via /api/cron/cleanup-instagram-logs.
create table if not exists public.instagram_publish_logs (
  id          uuid        primary key default gen_random_uuid(),
  post_id     uuid        not null references public.instagram_posts(id) on delete cascade,
  attempt_at  timestamptz not null default now(),
  success     boolean     not null,
  response    jsonb,
  error_code  text,
  duration_ms integer
);

create index if not exists ig_logs_post_idx
  on public.instagram_publish_logs (post_id, attempt_at desc);

alter table public.instagram_publish_logs enable row level security;

-- RLS: usuário só vê logs dos próprios posts (via JOIN com instagram_posts)
drop policy if exists "ig_logs_owner_select" on public.instagram_publish_logs;
create policy "ig_logs_owner_select" on public.instagram_publish_logs
  for select using (
    exists (
      select 1 from public.instagram_posts
      where id = instagram_publish_logs.post_id and user_id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGERS — updated_at automático
-- ============================================================
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'ig_accounts_updated_at') then
    create trigger ig_accounts_updated_at
      before update on public.instagram_accounts
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'ig_posts_updated_at') then
    create trigger ig_posts_updated_at
      before update on public.instagram_posts
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ============================================================
-- RPCs auxiliares
-- ============================================================

-- KPIs do dashboard (usada pelo PostStats e AccountStats no frontend)
create or replace function public.instagram_stats(p_user_id uuid)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'accounts_count',  (select count(*) from public.instagram_accounts
                          where user_id = p_user_id and is_active = true),
    'scheduled_count', (select count(*) from public.instagram_posts
                          where user_id = p_user_id and status = 'scheduled'),
    'published_30d',   (select count(*) from public.instagram_posts
                          where user_id = p_user_id and status = 'published'
                            and published_at >= now() - interval '30 days'),
    'failed_30d',      (select count(*) from public.instagram_posts
                          where user_id = p_user_id and status = 'failed'
                            and updated_at >= now() - interval '30 days')
  )
$$;

grant execute on function public.instagram_stats(uuid) to authenticated;

-- Limpeza TTL de logs (chamada pelo cron cleanup-instagram-logs 1x/dia)
create or replace function public.cleanup_instagram_logs(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.instagram_publish_logs
  where attempt_at < now() - (p_days || ' days')::interval;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.cleanup_instagram_logs(integer) to authenticated, anon;

-- ============================================================
-- STORAGE — bucket instagram-medias
-- ============================================================
-- Bucket público (Meta precisa baixar a mídia via URL pública).
-- RLS por pasta: cada usuário só escreve em {user_id}/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'instagram-medias',
  'instagram-medias',
  true,
  524288000,  -- 500 MB (limite para vídeo Reels)
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime'
  ]
)
on conflict (id) do nothing;

drop policy if exists "ig_medias_insert" on storage.objects;
create policy "ig_medias_insert" on storage.objects
  for insert with check (
    bucket_id = 'instagram-medias'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "ig_medias_delete" on storage.objects;
create policy "ig_medias_delete" on storage.objects
  for delete using (
    bucket_id = 'instagram-medias'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "ig_medias_update" on storage.objects;
create policy "ig_medias_update" on storage.objects
  for update using (
    bucket_id = 'instagram-medias'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- SELECT público (Instagram baixa a mídia ao publicar)
drop policy if exists "ig_medias_select_public" on storage.objects;
create policy "ig_medias_select_public" on storage.objects
  for select using (bucket_id = 'instagram-medias');

-- ============================================================
-- TABELA EXTRA: instagram_webhook_events  (vem da migração 107)
-- ============================================================
-- Eventos recebidos pelo webhook /api/webhooks/instagram da Meta.
-- Incluso aqui para o script ser standalone completo.
create table if not exists public.instagram_webhook_events (
  id          uuid        primary key default gen_random_uuid(),
  field       text        not null,        -- comments, mentions, story_insights, ...
  entry_id    text        not null,        -- ID da entidade IG (page/user)
  payload     jsonb       not null,
  received_at timestamptz not null default now()
);

create index if not exists ig_webhook_events_received_idx
  on public.instagram_webhook_events (received_at desc);

create index if not exists ig_webhook_events_field_idx
  on public.instagram_webhook_events (field, received_at desc);

alter table public.instagram_webhook_events enable row level security;
-- Nenhuma policy: leitura/escrita só via service role (admin client no webhook).

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
comment on table public.instagram_accounts is
  'Contas Instagram Business conectadas via OAuth Meta. Tokens criptografados AES-256-GCM.';
comment on table public.instagram_posts is
  'Posts agendados (IMAGE/REELS/CAROUSEL). Processados pelo cron publish-instagram.';
comment on table public.instagram_publish_logs is
  'Log detalhado de cada tentativa de publicação. TTL 30 dias via cron cleanup-instagram-logs.';
comment on table public.instagram_webhook_events is
  'Eventos recebidos do webhook Meta para Instagram (comments, mentions, etc.).';

comment on function public.instagram_stats is
  'Retorna KPIs do dashboard Instagram: contas ativas, agendados, publicados 30d, falhas 30d.';
comment on function public.cleanup_instagram_logs is
  'Apaga logs de publicação Instagram com mais de N dias (default 30).';

-- ============================================================
-- VERIFICAÇÃO FINAL — execute para confirmar
-- ============================================================
-- select table_name, column_name, data_type
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name in ('instagram_accounts', 'instagram_posts', 'instagram_publish_logs')
--  order by table_name, ordinal_position;
