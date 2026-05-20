-- ============================================================
-- Umbra Bot — Migração 065: Redirects real
-- Adiciona user_id, corrige RLS, cria redirect_click_events,
-- RPCs record_redirect_click e redirect_analytics
-- ============================================================

-- 1. Adicionar user_id à tabela redirects
alter table public.redirects
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2. Remover linhas órfãs (sem user_id — criadas pelo mock com bug)
delete from public.redirects where user_id is null;

-- 3. Tornar user_id obrigatório
alter table public.redirects alter column user_id set not null;

-- 4. Permitir utm null (era NOT NULL, quebrava inserts quando utm=null)
alter table public.redirects
  alter column utm drop not null,
  alter column utm set default null;

-- 5. Remover coluna url redundante (derivada de APP_URL/r/slug)
alter table public.redirects drop column if exists url;

-- 6. Corrigir RLS: policy aberta → policy por proprietário
drop policy if exists "redirects_open"  on public.redirects;
drop policy if exists "redirects_owner" on public.redirects;

create policy "redirects_owner" on public.redirects
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 7. Índice em user_id
create index if not exists redirects_user_id_idx on public.redirects (user_id);

-- ─── Tabela de eventos de clique ─────────────────────────────────────────────

create table if not exists public.redirect_click_events (
  id          uuid        primary key default gen_random_uuid(),
  redirect_id uuid        not null references public.redirects(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  ip_hash     text,
  referrer    text,
  device_type text        check (device_type in ('mobile', 'desktop', 'tablet', 'bot', 'unknown')),
  clicked_at  timestamptz not null default now()
);

create index if not exists rce_redirect_clicked_idx
  on public.redirect_click_events (redirect_id, clicked_at desc);

create index if not exists rce_user_clicked_idx
  on public.redirect_click_events (user_id, clicked_at desc);

alter table public.redirect_click_events enable row level security;

create policy "rce_owner_select" on public.redirect_click_events
  for select using (auth.uid() = user_id);

-- ─── RPC: record_redirect_click ──────────────────────────────────────────────
-- Chamada pela rota /r/[slug] sem sessão de usuário (security definer)
-- Insere o evento + incrementa counters de forma atômica

create or replace function public.record_redirect_click(
  p_redirect_id uuid,
  p_ip_hash     text,
  p_referrer    text,
  p_device_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid;
  v_is_unique boolean;
begin
  select user_id into v_user_id
  from public.redirects
  where id = p_redirect_id and status = 'active';

  if not found then return; end if;

  -- Clique único: mesmo IP nunca clicou neste link
  v_is_unique := (
    p_ip_hash is not null
    and p_ip_hash != 'unknown'
    and not exists (
      select 1 from public.redirect_click_events
      where redirect_id = p_redirect_id and ip_hash = p_ip_hash
    )
  );

  insert into public.redirect_click_events
    (redirect_id, user_id, ip_hash, referrer, device_type)
  values
    (p_redirect_id, v_user_id, p_ip_hash, p_referrer, p_device_type);

  update public.redirects
  set
    clicks        = clicks + 1,
    unique_clicks = unique_clicks + (case when v_is_unique then 1 else 0 end)
  where id = p_redirect_id;
end;
$$;

grant execute on function public.record_redirect_click(uuid, text, text, text)
  to anon, authenticated;

-- ─── RPC: redirect_analytics ─────────────────────────────────────────────────
-- Retorna analytics de um link (cliques por dia, por origem, por dispositivo)
-- Verifica que o link pertence ao usuário autenticado

create or replace function public.redirect_analytics(
  p_redirect_id uuid,
  p_days        int default 14
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Autorização: apenas o dono pode ver analytics
  if not exists (
    select 1 from public.redirects
    where id = p_redirect_id and user_id = auth.uid()
  ) then
    return null;
  end if;

  return (
    select json_build_object(
      'period_clicks', (
        select count(*)
        from public.redirect_click_events
        where redirect_id = p_redirect_id
          and clicked_at >= now() - (p_days || ' days')::interval
          and device_type != 'bot'
      ),
      'period_unique', (
        select count(distinct ip_hash)
        from public.redirect_click_events
        where redirect_id = p_redirect_id
          and clicked_at >= now() - (p_days || ' days')::interval
          and device_type != 'bot'
          and ip_hash is not null
          and ip_hash != 'unknown'
      ),
      'by_day', (
        select coalesce(json_agg(
          json_build_object('day', to_char(gs.d, 'DD/MM'), 'clicks', coalesce(daily.c, 0))
          order by gs.d
        ), '[]'::json)
        from generate_series(
          current_date - ((p_days - 1) * interval '1 day'),
          current_date,
          interval '1 day'
        ) as gs(d)
        left join (
          select
            (clicked_at at time zone 'America/Sao_Paulo')::date as dt,
            count(*) as c
          from public.redirect_click_events
          where redirect_id = p_redirect_id
            and clicked_at >= now() - (p_days || ' days')::interval
            and device_type != 'bot'
          group by 1
        ) as daily on daily.dt = gs.d
      ),
      'by_source', (
        select coalesce(json_agg(
          json_build_object('name', source, 'value', cnt)
          order by cnt desc
        ), '[]'::json)
        from (
          select
            case
              when referrer is null or referrer = '' then 'Direto'
              when referrer ilike '%instagram%'      then 'Instagram'
              when referrer ilike '%google%'         then 'Google'
              when referrer ilike '%youtube%'        then 'YouTube'
              when referrer ilike '%tiktok%'         then 'TikTok'
              when referrer ilike '%whatsapp%'       then 'WhatsApp'
              when referrer ilike '%facebook%'       then 'Facebook'
              when referrer ilike '%twitter%'
                or referrer ilike '%t.co%'           then 'Twitter/X'
              else 'Outros'
            end as source,
            count(*) as cnt
          from public.redirect_click_events
          where redirect_id = p_redirect_id
            and clicked_at >= now() - (p_days || ' days')::interval
            and device_type != 'bot'
          group by 1
          order by 2 desc
          limit 6
        ) as s
      ),
      'by_device', (
        select coalesce(json_agg(
          json_build_object('name', device, 'value', cnt)
          order by cnt desc
        ), '[]'::json)
        from (
          select
            case device_type
              when 'mobile'  then 'Mobile'
              when 'desktop' then 'Desktop'
              when 'tablet'  then 'Tablet'
              else 'Outros'
            end as device,
            count(*) as cnt
          from public.redirect_click_events
          where redirect_id = p_redirect_id
            and clicked_at >= now() - (p_days || ' days')::interval
            and device_type not in ('bot', 'unknown')
          group by 1
          order by 2 desc
        ) as d
      )
    )
  );
end;
$$;

grant execute on function public.redirect_analytics(uuid, int) to authenticated;
