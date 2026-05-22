-- 088_biolinks_fix.sql
-- Fix biolinks: add user_id, correct RLS, visit/click tracking tables and RPCs

-- 1. Add user_id column to biolinks
alter table public.biolinks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2. Drop old global unique constraint on slug (if it exists)
do $$ begin
  if exists (
    select 1 from information_schema.table_constraints
     where table_name = 'biolinks' and constraint_name = 'biolinks_slug_key'
       and table_schema = 'public'
  ) then
    alter table public.biolinks drop constraint biolinks_slug_key;
  end if;
end $$;

-- Composite unique index: one slug per user (allows same slug for different users)
create unique index if not exists biolinks_user_slug_idx
  on public.biolinks (user_id, slug)
  where user_id is not null;

-- 3. Index for efficient user_id lookups
create index if not exists biolinks_user_id_idx on public.biolinks (user_id);

-- 4. Fix RLS: replace open policy with owner policy
drop policy if exists "biolinks_open"  on public.biolinks;
drop policy if exists "biolinks_owner" on public.biolinks;

create policy "biolinks_owner" on public.biolinks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. biolink_view_events — tracks page visits
create table if not exists public.biolink_view_events (
  id           uuid        primary key default gen_random_uuid(),
  biolink_id   text        not null references public.biolinks(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  ip_hash      text,
  referrer     text,
  device_type  text        check (device_type in ('mobile','desktop','tablet','bot','unknown')),
  viewed_at    timestamptz not null default now()
);

create index if not exists bve_biolink_viewed_idx on public.biolink_view_events (biolink_id, viewed_at desc);
create index if not exists bve_user_viewed_idx    on public.biolink_view_events (user_id,    viewed_at desc);

alter table public.biolink_view_events enable row level security;

create policy "bve_owner_select" on public.biolink_view_events
  for select using (auth.uid() = user_id);

-- 6. biolink_click_events — tracks individual link clicks
create table if not exists public.biolink_click_events (
  id           uuid        primary key default gen_random_uuid(),
  biolink_id   text        not null references public.biolinks(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  link_id      text        not null,
  link_url     text,
  ip_hash      text,
  referrer     text,
  device_type  text        check (device_type in ('mobile','desktop','tablet','bot','unknown')),
  clicked_at   timestamptz not null default now()
);

create index if not exists bce_biolink_clicked_idx on public.biolink_click_events (biolink_id, clicked_at desc);
create index if not exists bce_link_id_idx         on public.biolink_click_events (link_id,    clicked_at desc);
create index if not exists bce_user_clicked_idx    on public.biolink_click_events (user_id,    clicked_at desc);

alter table public.biolink_click_events enable row level security;

create policy "bce_owner_select" on public.biolink_click_events
  for select using (auth.uid() = user_id);

-- 7. RPC: record_biolink_visit — called by public page visitors
create or replace function public.record_biolink_visit(
  p_slug        text,
  p_ip_hash     text  default null,
  p_referrer    text  default null,
  p_device_type text  default 'unknown'
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id      text;
  v_user_id uuid;
begin
  select id, user_id into v_id, v_user_id
    from public.biolinks
   where slug = p_slug and status = 'published'
   limit 1;
  if v_id is null then return; end if;

  insert into public.biolink_view_events (biolink_id, user_id, ip_hash, referrer, device_type)
  values (v_id, v_user_id, p_ip_hash, p_referrer, p_device_type);

  update public.biolinks set views = views + 1 where id = v_id;
end;
$$;

grant execute on function public.record_biolink_visit to anon, authenticated;

-- 8. RPC: record_biolink_link_click — called when a visitor clicks a link
create or replace function public.record_biolink_link_click(
  p_slug        text,
  p_link_id     text,
  p_link_url    text  default null,
  p_ip_hash     text  default null,
  p_referrer    text  default null,
  p_device_type text  default 'unknown'
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id      text;
  v_user_id uuid;
begin
  select id, user_id into v_id, v_user_id
    from public.biolinks
   where slug = p_slug and status = 'published'
   limit 1;
  if v_id is null then return; end if;

  insert into public.biolink_click_events (biolink_id, user_id, link_id, link_url, ip_hash, referrer, device_type)
  values (v_id, v_user_id, p_link_id, p_link_url, p_ip_hash, p_referrer, p_device_type);

  update public.biolinks set clicks = clicks + 1 where id = v_id;
end;
$$;

grant execute on function public.record_biolink_link_click to anon, authenticated;

-- 9. RPC: biolink_analytics — per-link click stats for the dashboard
create or replace function public.biolink_analytics(
  p_user_id uuid,
  p_days    int default 30
) returns json
language sql stable security invoker set search_path = public
as $$
  select json_build_object(
    'views_period',   coalesce((
      select count(*)::int
        from public.biolink_view_events bve
        join public.biolinks bl on bl.id = bve.biolink_id
       where bl.user_id = p_user_id
         and bve.viewed_at >= now() - (p_days || ' days')::interval
    ), 0),
    'clicks_period',  coalesce((
      select count(*)::int
        from public.biolink_click_events bce
        join public.biolinks bl on bl.id = bce.biolink_id
       where bl.user_id = p_user_id
         and bce.clicked_at >= now() - (p_days || ' days')::interval
    ), 0),
    'clicks_by_link', coalesce((
      select json_object_agg(bce.link_id, cnt)
        from (
          select bce2.link_id, count(*)::int as cnt
            from public.biolink_click_events bce2
            join public.biolinks bl on bl.id = bce2.biolink_id
           where bl.user_id = p_user_id
             and bce2.clicked_at >= now() - (p_days || ' days')::interval
           group by bce2.link_id
        ) bce
    ), '{}')
  );
$$;

grant execute on function public.biolink_analytics to authenticated;
