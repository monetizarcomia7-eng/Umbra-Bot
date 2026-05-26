-- ============================================================
-- Umbra Bot — Migração 106: Instagram Scheduler (novo módulo)
-- ============================================================
-- Implementa o agendador de posts do Instagram conforme docs/INSTAGRAM_SAAS_COMPLETO.md
-- adaptado à infraestrutura existente do Umbra Bot:
--   - tokens criptografados via lib/crypto (AES-256-GCM, prefixo `enc:`)
--   - mídias no Supabase Storage (bucket instagram-medias)
--   - crons via cron-job.org com Authorization: Bearer CRON_SECRET
--   - rate-limit via Upstash Redis (lib/rate-limit)
--   - PostHog para eventos
-- ============================================================

-- ─── Tabela: instagram_accounts ──────────────────────────────────────────
-- Contas Instagram Business conectadas via OAuth Meta (até 60 dias por token)
create table if not exists public.instagram_accounts (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  ig_user_id        text        not null,                              -- ID da conta no Instagram
  username          text,
  profile_picture   text,
  access_token      text        not null,                              -- criptografado AES-256-GCM
  token_expires_at  timestamptz,
  page_id           text,                                              -- Facebook Page ID vinculada
  page_token        text,                                              -- criptografado AES-256-GCM
  is_active         boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, ig_user_id)
);

create index if not exists ig_accounts_user_id_idx on public.instagram_accounts (user_id);
create index if not exists ig_accounts_token_expires_idx
  on public.instagram_accounts (token_expires_at)
  where is_active = true;

alter table public.instagram_accounts enable row level security;

drop policy if exists "ig_accounts_owner" on public.instagram_accounts;
create policy "ig_accounts_owner" on public.instagram_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Tabela: instagram_posts ─────────────────────────────────────────────
-- Posts agendados (IMAGE / REELS / CAROUSEL)
create table if not exists public.instagram_posts (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  account_id    uuid        not null references public.instagram_accounts(id) on delete cascade,
  media_type    text        not null check (media_type in ('IMAGE', 'REELS', 'CAROUSEL')),
  media_urls    text[]      not null,
  caption       text        not null default '',
  scheduled_at  timestamptz not null,
  status        text        not null default 'scheduled'
                  check (status in ('draft','scheduled','publishing','published','failed','cancelled')),
  ig_post_id    text,                                                  -- ID do post no Instagram após publicação
  published_at  timestamptz,
  error_msg     text,
  retry_count   integer     not null default 0,
  max_retries   integer     not null default 3,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Índice principal para o cron worker (busca pendentes)
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

-- ─── Tabela: instagram_publish_logs ──────────────────────────────────────
-- Log detalhado de cada tentativa de publicação (telemetria)
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

drop policy if exists "ig_logs_owner_select" on public.instagram_publish_logs;
create policy "ig_logs_owner_select" on public.instagram_publish_logs
  for select using (
    exists (
      select 1 from public.instagram_posts
      where id = instagram_publish_logs.post_id and user_id = auth.uid()
    )
  );

-- ─── Triggers updated_at ─────────────────────────────────────────────────
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

-- ─── RPC: instagram_stats (KPIs do dashboard) ────────────────────────────
create or replace function public.instagram_stats(p_user_id uuid)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'accounts_count',     (select count(*) from public.instagram_accounts where user_id = p_user_id and is_active = true),
    'scheduled_count',    (select count(*) from public.instagram_posts    where user_id = p_user_id and status = 'scheduled'),
    'published_30d',      (select count(*) from public.instagram_posts    where user_id = p_user_id and status = 'published' and published_at >= now() - interval '30 days'),
    'failed_30d',         (select count(*) from public.instagram_posts    where user_id = p_user_id and status = 'failed' and updated_at >= now() - interval '30 days')
  )
$$;

grant execute on function public.instagram_stats(uuid) to authenticated;

-- ─── RPC: cleanup_instagram_logs (TTL 30d, chamada por cron) ─────────────
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

comment on function public.cleanup_instagram_logs is
  'Apaga logs de publicação Instagram com mais de N dias (default 30).';

-- ─── Storage: bucket instagram-medias ────────────────────────────────────
-- Bucket público (Instagram precisa baixar a mídia via URL pública)
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

-- RLS de storage: usuário só faz upload/delete na própria pasta {user_id}/
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

-- SELECT: público (Instagram precisa acessar para baixar)
drop policy if exists "ig_medias_select_public" on storage.objects;
create policy "ig_medias_select_public" on storage.objects
  for select using (bucket_id = 'instagram-medias');

comment on table public.instagram_accounts is
  'Contas Instagram Business conectadas via OAuth Meta. Tokens criptografados AES-256-GCM.';
comment on table public.instagram_posts is
  'Posts agendados (IMAGE/REELS/CAROUSEL). Processados pelo cron publish-instagram.';
comment on table public.instagram_publish_logs is
  'Log detalhado de cada tentativa de publicação. TTL 30 dias via cron cleanup-instagram-logs.';
