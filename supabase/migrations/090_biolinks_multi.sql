-- 090_biolinks_multi.sql
-- Updates biolink_analytics RPC to support optional per-biolink filtering
-- Enables the multi-biolink dashboard to load analytics per biolink

create or replace function public.biolink_analytics(
  p_user_id    uuid,
  p_days       int  default 30,
  p_biolink_id text default null
) returns json
language sql stable security invoker set search_path = public
as $$
  select json_build_object(
    'views_period',   coalesce((
      select count(*)::int
        from public.biolink_view_events bve
        join public.biolinks bl on bl.id = bve.biolink_id
       where bl.user_id = p_user_id
         and (p_biolink_id is null or bl.id = p_biolink_id)
         and bve.viewed_at >= now() - (p_days || ' days')::interval
    ), 0),
    'clicks_period',  coalesce((
      select count(*)::int
        from public.biolink_click_events bce
        join public.biolinks bl on bl.id = bce.biolink_id
       where bl.user_id = p_user_id
         and (p_biolink_id is null or bl.id = p_biolink_id)
         and bce.clicked_at >= now() - (p_days || ' days')::interval
    ), 0),
    'clicks_by_link', coalesce((
      select json_object_agg(bce.link_id, cnt)
        from (
          select bce2.link_id, count(*)::int as cnt
            from public.biolink_click_events bce2
            join public.biolinks bl on bl.id = bce2.biolink_id
           where bl.user_id = p_user_id
             and (p_biolink_id is null or bl.id = p_biolink_id)
             and bce2.clicked_at >= now() - (p_days || ' days')::interval
           group by bce2.link_id
        ) bce
    ), '{}')
  );
$$;

grant execute on function public.biolink_analytics to authenticated;
