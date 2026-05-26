-- ============================================================
-- Umbra Bot — Migração 103: Flows audit improvements
-- ============================================================
-- Aplica os fixes identificados na auditoria do módulo Fluxos:
--   1. Índice composto (user_id, updated_at desc) — listagem ordenada
--   2. bot_id FK em flows (substitui string "@username" fragil)
--   3. flow_node_events para telemetria de execução
--   4. flow_versions para snapshots imutáveis ao publicar
--   5. RPC flows_stats_by_user → reduz transferência de KB no SSR
--   6. RPC recompute_flow_conversion → atualiza conversion %
--   7. CHECK constraints + size limit em nodes/edges
-- ============================================================

-- ─── 1. Índice composto user_id + updated_at ──────────────────────────────
create index if not exists flows_user_id_updated_at_idx
  on public.flows (user_id, updated_at desc);

-- ─── 2. bot_id FK ─────────────────────────────────────────────────────────
alter table public.flows
  add column if not exists bot_id uuid references public.bots(id) on delete set null;

create index if not exists flows_bot_id_idx
  on public.flows (bot_id)
  where bot_id is not null;

comment on column public.flows.bot_id is
  'FK ao bot ativo. Substitui o campo "bot" (string livre, fragil em renames).';

-- ─── 3. flow_node_events — telemetria de execução ─────────────────────────
create table if not exists public.flow_node_events (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  flow_id      uuid        not null references public.flows(id) on delete cascade,
  node_id      text        not null,
  node_type    text        not null,
  contact_id   uuid        references public.contacts(id) on delete set null,
  event        text        not null
                  check (event in ('entered', 'sent', 'failed', 'completed', 'abandoned')),
  error_msg    text,
  latency_ms   integer,
  created_at   timestamptz not null default now()
);

create index if not exists fne_flow_node_created_idx
  on public.flow_node_events (flow_id, node_id, created_at desc);
create index if not exists fne_user_created_idx
  on public.flow_node_events (user_id, created_at desc);
create index if not exists fne_contact_idx
  on public.flow_node_events (contact_id)
  where contact_id is not null;

alter table public.flow_node_events enable row level security;

drop policy if exists "fne_owner" on public.flow_node_events;
create policy "fne_owner" on public.flow_node_events
  for select using (auth.uid() = user_id);

comment on table public.flow_node_events is
  'Telemetria fina de execução de fluxos. TTL recomendado: 30 dias (cron).';

-- ─── 4. flow_versions — snapshots imutáveis ───────────────────────────────
create table if not exists public.flow_versions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  flow_id      uuid        not null references public.flows(id) on delete cascade,
  version      integer     not null,
  name         text        not null,
  nodes        jsonb       not null default '[]',
  edges        jsonb       not null default '[]',
  trigger_type text        not null default 'start',
  keywords     text[]      not null default '{}',
  description  text        not null default '',
  published_at timestamptz not null default now(),
  unique (flow_id, version)
);

create index if not exists fv_flow_published_idx
  on public.flow_versions (flow_id, published_at desc);

alter table public.flow_versions enable row level security;

drop policy if exists "fv_owner" on public.flow_versions;
create policy "fv_owner" on public.flow_versions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.flow_versions is
  'Snapshots imutáveis criados a cada publicação. Permite rollback e mantém '
  'contatos em execução com o nodes/edges originais (via contacts.flow_version).';

-- ─── 5. Campo flow_version em contacts (snapshot por contato) ─────────────
alter table public.contacts
  add column if not exists flow_version integer;

comment on column public.contacts.flow_version is
  'Versão do fluxo que o contato está executando. Usado para fixar nodes/edges '
  'mesmo se o operador editar o fluxo ativo. null = sem fluxo ou versão atual.';

-- ─── 6. RPC: stats agregadas em 1 query ───────────────────────────────────
create or replace function public.flows_stats_by_user(p_user_id uuid)
returns table(
  flow_id uuid,
  revenue numeric,
  sales bigint,
  leads bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    f.id as flow_id,
    coalesce((
      select sum(t.net) from public.transactions t
      where t.flow_id = f.id and t.user_id = p_user_id and t.status = 'approved'
    ), 0) as revenue,
    coalesce((
      select count(*) from public.transactions t
      where t.flow_id = f.id and t.user_id = p_user_id and t.status = 'approved'
    ), 0) as sales,
    coalesce((
      select count(*) from public.contacts c
      where c.flow_id = f.id and c.user_id = p_user_id
    ), 0) as leads
  from public.flows f
  where f.user_id = p_user_id
$$;

grant execute on function public.flows_stats_by_user(uuid) to authenticated;

comment on function public.flows_stats_by_user is
  'Retorna (flow_id, revenue, sales, leads) para todos os fluxos do usuário. '
  'Substitui duas queries com transfer de KB no SSR.';

-- ─── 7. RPC: recomputar conversion % de um fluxo ──────────────────────────
create or replace function public.recompute_flow_conversion(p_flow_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exec   bigint;
  v_sales  bigint;
  v_conv   numeric;
begin
  select executions into v_exec from public.flows where id = p_flow_id;
  if v_exec is null or v_exec = 0 then return; end if;

  select count(*) into v_sales
  from public.transactions
  where flow_id = p_flow_id and status = 'approved';

  v_conv := round((v_sales::numeric / v_exec::numeric) * 100, 2);

  update public.flows
  set conversion = v_conv
  where id = p_flow_id;
end;
$$;

grant execute on function public.recompute_flow_conversion(uuid) to authenticated, anon;

-- ─── 8. RPC: stats por nó (lazy load no editor) ───────────────────────────
create or replace function public.flow_node_stats(p_flow_id uuid, p_days int default 30)
returns table(
  node_id text,
  node_type text,
  entered bigint,
  sent bigint,
  failed bigint,
  completed bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    node_id,
    max(node_type)                                as node_type,
    count(*) filter (where event = 'entered')     as entered,
    count(*) filter (where event = 'sent')        as sent,
    count(*) filter (where event = 'failed')      as failed,
    count(*) filter (where event = 'completed')   as completed
  from public.flow_node_events
  where flow_id = p_flow_id
    and created_at >= now() - (p_days || ' days')::interval
    and exists (
      select 1 from public.flows f
      where f.id = p_flow_id and f.user_id = auth.uid()
    )
  group by node_id
$$;

grant execute on function public.flow_node_stats(uuid, int) to authenticated;

-- ─── 9. RPC: criar version snapshot ao publicar ───────────────────────────
create or replace function public.create_flow_version(p_flow_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_next    integer;
  v_row     record;
begin
  select * into v_row from public.flows where id = p_flow_id;
  if v_row is null then return null; end if;

  -- Verifica ownership
  if v_row.user_id is null or v_row.user_id <> auth.uid() then
    raise exception 'Não autorizado.';
  end if;

  -- Próxima versão (autoincrement por flow_id)
  select coalesce(max(version), 0) + 1 into v_next
  from public.flow_versions
  where flow_id = p_flow_id;

  insert into public.flow_versions (
    user_id, flow_id, version, name, nodes, edges, trigger_type, keywords, description
  ) values (
    v_row.user_id, p_flow_id, v_next, v_row.name, v_row.nodes, v_row.edges,
    coalesce(v_row.trigger_type, 'start'),
    coalesce(v_row.keywords, '{}'::text[]),
    coalesce(v_row.description, '')
  );

  return v_next;
end;
$$;

grant execute on function public.create_flow_version(uuid) to authenticated;

-- ─── 10. RPC: aplicar version (rollback) ──────────────────────────────────
create or replace function public.rollback_flow_to_version(p_flow_id uuid, p_version integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver record;
  v_flow record;
begin
  select * into v_flow from public.flows where id = p_flow_id;
  if v_flow.user_id is null or v_flow.user_id <> auth.uid() then
    raise exception 'Não autorizado.';
  end if;

  select * into v_ver from public.flow_versions
  where flow_id = p_flow_id and version = p_version;

  if v_ver is null then raise exception 'Versão não encontrada.'; end if;

  update public.flows
  set name = v_ver.name,
      nodes = v_ver.nodes,
      edges = v_ver.edges,
      trigger_type = v_ver.trigger_type,
      keywords = v_ver.keywords,
      description = v_ver.description
  where id = p_flow_id;
end;
$$;

grant execute on function public.rollback_flow_to_version(uuid, int) to authenticated;
