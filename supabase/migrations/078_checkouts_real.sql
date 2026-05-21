-- ============================================================
-- Umbra Bot — Checkout: checkout_id em checkout_events +
-- trigger de sync de visitas/conversões + RPC pública de visita
-- ============================================================

-- ── 1. Adicionar checkout_id em checkout_events ─────────────
alter table public.checkout_events
  add column if not exists checkout_id text references public.checkouts(id) on delete set null;

create index if not exists coe_checkout_id_idx
  on public.checkout_events (checkout_id)
  where checkout_id is not null;

-- ── 2. Trigger: sync de visits/conversions/conversion ───────
create or replace function public.sync_checkout_stats()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_visits      bigint := 0;
  v_conversions bigint := 0;
begin
  if new.checkout_id is not null then
    select
      count(*) filter (where event_type = 'visited'),
      count(*) filter (where event_type = 'paid')
    into v_visits, v_conversions
    from public.checkout_events
    where checkout_id = new.checkout_id;

    update public.checkouts set
      visits      = v_visits::integer,
      conversions = v_conversions::integer,
      conversion  = case
        when v_visits > 0 then round(v_conversions::numeric / v_visits * 100, 2)
        else 0
      end
    where id = new.checkout_id;
  end if;
  return new;
end;
$$;

create or replace trigger trg_sync_checkout_stats
  after insert on public.checkout_events
  for each row execute function public.sync_checkout_stats();

-- ── 3. Índice composto para analytics de checkout ───────────
create index if not exists checkout_events_checkout_type_idx
  on public.checkout_events (checkout_id, event_type)
  where checkout_id is not null;

-- ── 4. RPC pública para rastrear visita (por slug, sem auth) ─
create or replace function public.track_checkout_visit(
  p_slug          text,
  p_utm_source    text  default null,
  p_utm_medium    text  default null,
  p_utm_campaign  text  default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_co record;
begin
  select id, user_id, product_name into v_co
  from public.checkouts
  where slug = p_slug and status = 'published'
  limit 1;

  if not found then return; end if;

  insert into public.checkout_events (
    user_id, checkout_id, event_type, product_name,
    utm_source, utm_medium, utm_campaign
  ) values (
    v_co.user_id, v_co.id, 'visited', v_co.product_name,
    p_utm_source, p_utm_medium, p_utm_campaign
  );
end;
$$;

grant execute on function public.track_checkout_visit to anon, authenticated;
