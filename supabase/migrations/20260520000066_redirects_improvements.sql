-- ============================================================
-- Umbra Bot — Migração 066: Melhorias nos Redirecionadores
-- RPC redirect_unique_clicks_30d para KPI de cliques únicos no período
-- ============================================================

-- RPC: contagem de IPs únicos nos últimos 30 dias para um usuário
create or replace function public.redirect_unique_clicks_30d(p_user_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(distinct ip_hash)
  from public.redirect_click_events
  where user_id      = p_user_id
    and clicked_at  >= now() - interval '30 days'
    and device_type != 'bot'
    and ip_hash     is not null
    and ip_hash     != 'unknown'
$$;

grant execute on function public.redirect_unique_clicks_30d(uuid) to authenticated;
