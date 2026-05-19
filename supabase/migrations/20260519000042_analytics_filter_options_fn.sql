-- ============================================================
-- Umbra Bot — Função: analytics_filter_options
--
-- Performance: substitui duas queries de 500 linhas c/ dedup JS
-- por um único SELECT DISTINCT no banco — zero linhas duplicadas.
--
-- Retorna JSON com arrays ordenados de product_name e utm_source
-- distintos do usuário, para popular os dropdowns de filtro.
--
-- Populado por: app/dashboard/analytics/page.tsx (mainBatch)
-- ============================================================

create or replace function public.analytics_filter_options(p_user_id uuid)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'products', (
      select coalesce(json_agg(p order by p), '[]'::json)
      from (
        select distinct product_name as p
        from public.transactions
        where user_id = p_user_id
          and product_name is not null
          and product_name <> ''
      ) _
    ),
    'utm_sources', (
      select coalesce(json_agg(u order by u), '[]'::json)
      from (
        select distinct utm_source as u
        from public.transactions
        where user_id = p_user_id
          and utm_source is not null
      ) _
    )
  )
$$;

grant execute
  on function public.analytics_filter_options(uuid)
  to authenticated;
