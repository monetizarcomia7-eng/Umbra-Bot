-- ============================================================
-- Umbra Bot — Webhooks real (migração 091)
-- Corrige schema, adiciona user_id, cria webhook_deliveries,
-- ajusta RLS e adiciona RPCs de stats.
-- ============================================================

-- ── 1. Adiciona user_id à tabela webhooks ────────────────────────────────────

alter table public.webhooks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Atualiza PK para usar UUID gerado automaticamente em novos registros.
-- A coluna id continua text para retrocompatibilidade com registros existentes.
-- Novos registros devem usar gen_random_uuid()::text na aplicação.

-- ── 2. Remove RLS aberta e substitui por policy owner ────────────────────────

alter table public.webhooks enable row level security;

drop policy if exists "webhooks_open"  on public.webhooks;
drop policy if exists "webhooks_owner" on public.webhooks;

create policy "webhooks_owner" on public.webhooks
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists webhooks_user_id_idx on public.webhooks (user_id);

-- ── 3. Cria tabela webhook_deliveries ────────────────────────────────────────

create table if not exists public.webhook_deliveries (
  id              uuid        primary key default gen_random_uuid(),
  webhook_id      text        not null references public.webhooks(id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  event_type      text        not null,
  payload         jsonb       not null default '{}',
  response_status integer,
  response_body   text,
  duration_ms     integer,
  success         boolean     not null default false,
  attempt         integer     not null default 1,
  created_at      timestamptz not null default now()
);

create index if not exists wd_webhook_created_idx on public.webhook_deliveries (webhook_id, created_at desc);
create index if not exists wd_user_created_idx    on public.webhook_deliveries (user_id,    created_at desc);
create index if not exists wd_success_idx         on public.webhook_deliveries (webhook_id, success);

alter table public.webhook_deliveries enable row level security;

drop policy if exists "wd_owner" on public.webhook_deliveries;
create policy "wd_owner" on public.webhook_deliveries
  for select
  using (auth.uid() = user_id);

-- ── 4. Trigger updated_at (se não existir) ───────────────────────────────────

create or replace trigger webhooks_updated_at
  before update on public.webhooks
  for each row execute function public.set_updated_at();

-- ── 5. RPC webhooks_stats ────────────────────────────────────────────────────
-- Retorna métricas agregadas dos webhooks do usuário.
-- Calcula deliveries_24h e success_rate diretamente da tabela webhook_deliveries.

create or replace function public.webhooks_stats(p_user_id uuid)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'total',          count(*)                                     filter (where user_id = p_user_id),
    'active',         count(*)                                     filter (where user_id = p_user_id and active = true),
    'failing',        count(*)                                     filter (where user_id = p_user_id and status = 'failing'),
    'deliveries_24h', coalesce((
      select count(*)
      from   webhook_deliveries wd
      where  wd.user_id    = p_user_id
        and  wd.created_at >= now() - interval '24 hours'
    ), 0),
    'success_rate', coalesce((
      select round(
        100.0 * count(*) filter (where success = true)::numeric
        / nullif(count(*), 0), 1
      )
      from   webhook_deliveries wd
      where  wd.user_id    = p_user_id
        and  wd.created_at >= now() - interval '24 hours'
    ), 100)
  )
  from public.webhooks
  where user_id = p_user_id;
$$;

grant execute on function public.webhooks_stats(uuid) to authenticated;

-- ── 6. RPC sync_webhook_stats ─────────────────────────────────────────────────
-- Chamada pelo dispatcher após cada entrega para manter deliveries_24h
-- e success_rate sincronizados na tabela webhooks (desnormalizado para leitura
-- rápida nos KPIs sem precisar agregar webhook_deliveries a cada page load).

create or replace function public.sync_webhook_stats(p_webhook_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.webhooks
  set
    deliveries_24h = (
      select count(*)
      from   webhook_deliveries
      where  webhook_id = p_webhook_id
        and  created_at >= now() - interval '24 hours'
    ),
    success_rate = coalesce((
      select round(
        100.0 * count(*) filter (where success = true)::numeric
        / nullif(count(*), 0), 1
      )
      from   webhook_deliveries
      where  webhook_id = p_webhook_id
        and  created_at >= now() - interval '24 hours'
    ), 100),
    status = case
      when (
        select round(
          100.0 * count(*) filter (where success = true)::numeric
          / nullif(count(*), 0), 1
        )
        from   webhook_deliveries
        where  webhook_id = p_webhook_id
          and  created_at >= now() - interval '24 hours'
      ) < 80 then 'failing'
      else 'healthy'
    end,
    updated_at = now()
  where id = p_webhook_id
    and active = true;
$$;

grant execute on function public.sync_webhook_stats(text) to authenticated, service_role;
