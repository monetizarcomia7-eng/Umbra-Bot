-- Migration 101: Flow stats RPC
-- Atomic increment of flow executions counter

create or replace function public.increment_flow_executions(p_flow_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.flows
  set executions = executions + 1
  where id = p_flow_id;
$$;

grant execute on function public.increment_flow_executions(uuid) to authenticated, anon;
