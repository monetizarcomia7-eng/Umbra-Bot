-- ============================================================
-- Umbra Bot — Customers tab improvements (migration 052)
--
-- 1. Adiciona colunas faltantes em contacts
--    (origin, first_purchase, last_purchase, avg_ticket)
-- 2. Trigger que sincroniza estatísticas de compra dos contacts
--    quando uma transaction muda (contact_id FK)
-- 3. Backfill de dados históricos
-- 4. RPC contacts_summary — total / buyers / leads
-- 5. RPC contacts_bulk_add_tag — adiciona tag em N contacts (1 query)
-- 6. RPC contacts_filter_options — origens distintas para o dropdown
-- 7. Índices auxiliares
-- ============================================================

-- ── 1. Colunas faltantes ────────────────────────────────────

alter table public.contacts
  add column if not exists origin         text,
  add column if not exists first_purchase timestamptz,
  add column if not exists last_purchase  timestamptz,
  add column if not exists avg_ticket     numeric(10,2) not null default 0;

-- ── 2. Trigger: sincroniza estatísticas de compra ───────────

create or replace function public.sync_contact_purchase_stats()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_contact_id uuid;
  v_cnt        bigint;
  v_total      numeric(12,2);
  v_first      timestamptz;
  v_last       timestamptz;
begin
  v_contact_id := case when TG_OP = 'DELETE' then OLD.contact_id else NEW.contact_id end;
  if v_contact_id is null then return coalesce(NEW, OLD); end if;

  select
    count(*)                                     filter (where status = 'approved'),
    coalesce(sum(net) filter (where status = 'approved'), 0),
    min(created_at)                              filter (where status = 'approved'),
    max(created_at)                              filter (where status = 'approved')
  into v_cnt, v_total, v_first, v_last
  from public.transactions
  where contact_id = v_contact_id;

  update public.contacts
  set
    purchases      = coalesce(v_cnt, 0),
    orders_count   = coalesce(v_cnt, 0),
    total_spent    = coalesce(v_total, 0),
    avg_ticket     = case when coalesce(v_cnt, 0) > 0 then round(v_total / v_cnt, 2) else 0 end,
    first_purchase = v_first,
    last_purchase  = v_last,
    updated_at     = now()
  where id = v_contact_id;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_sync_contact_stats on public.transactions;
create trigger trg_sync_contact_stats
  after insert or update of status, net, contact_id or delete
  on public.transactions
  for each row execute function public.sync_contact_purchase_stats();

-- ── 3. Backfill estatísticas de compra existentes ───────────

update public.contacts c
set
  purchases      = s.cnt,
  orders_count   = s.cnt,
  total_spent    = s.total,
  avg_ticket     = case when s.cnt > 0 then round(s.total / s.cnt, 2) else 0 end,
  first_purchase = s.first_p,
  last_purchase  = s.last_p
from (
  select
    contact_id,
    count(*)                                                  filter (where status = 'approved') as cnt,
    coalesce(sum(net) filter (where status = 'approved'), 0)                                    as total,
    min(created_at)                                           filter (where status = 'approved') as first_p,
    max(created_at)                                           filter (where status = 'approved') as last_p
  from public.transactions
  where contact_id is not null
  group by contact_id
) s
where c.id = s.contact_id;

-- Backfill origin: usa utm_source da primeira transação vinculada
update public.contacts c
set origin = t.utm_source
from (
  select distinct on (contact_id) contact_id, utm_source
  from public.transactions
  where contact_id is not null
    and utm_source is not null
    and utm_source <> ''
  order by contact_id, created_at asc
) t
where c.id = t.contact_id
  and c.origin is null;

-- ── 4. RPC contacts_summary ─────────────────────────────────

create or replace function public.contacts_summary(p_user_id uuid)
returns json language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'total',  count(*),
    'buyers', count(*) filter (where coalesce(purchases, 0) > 0),
    'leads',  count(*) filter (where coalesce(purchases, 0) = 0)
  )
  from public.contacts
  where user_id = p_user_id
$$;

grant execute on function public.contacts_summary(uuid) to authenticated;

-- ── 5. RPC contacts_bulk_add_tag ────────────────────────────

create or replace function public.contacts_bulk_add_tag(p_ids uuid[], p_tag text)
returns void language sql security invoker set search_path = public as $$
  update public.contacts
  set
    tags       = array_append(tags, p_tag),
    updated_at = now()
  where id = any(p_ids)
    and auth.uid() = user_id
    and not (tags @> array[p_tag]);
$$;

grant execute on function public.contacts_bulk_add_tag(uuid[], text) to authenticated;

-- ── 6. RPC contacts_filter_options ──────────────────────────

create or replace function public.contacts_filter_options(p_user_id uuid)
returns json language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'origins', coalesce(
      (select array_agg(distinct origin order by origin)
       from public.contacts
       where user_id = p_user_id and origin is not null and origin <> ''),
      '{}'::text[]
    )
  )
$$;

grant execute on function public.contacts_filter_options(uuid) to authenticated;

-- ── 7. Índices ───────────────────────────────────────────────

create index if not exists contacts_origin_idx
  on public.contacts (origin) where origin is not null;

create index if not exists contacts_user_last_contact_idx
  on public.contacts (user_id, last_contact desc)
  where user_id is not null;

create index if not exists contacts_user_purchases_idx
  on public.contacts (user_id, purchases)
  where user_id is not null;
