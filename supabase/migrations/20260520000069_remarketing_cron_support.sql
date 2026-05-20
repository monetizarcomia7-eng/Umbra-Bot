-- ============================================================
-- Umbra Bot — Remarketing: suporte ao cron de envio
-- Migração 069
-- ============================================================

-- Garante que contacts tem índice em (user_id, bot_id, telegram_id)
-- para a query de contatos elegíveis rodar rápido no cron.
create index if not exists contacts_user_bot_tg_idx
  on public.contacts (user_id, bot_id, telegram_id)
  where telegram_id is not null;

-- Índice para buscar execuções pendentes vencidas (Task 2 do cron)
create index if not exists re_pending_scheduled_idx
  on public.remarketing_executions (scheduled_at)
  where status = 'pending';

-- Garante que a coluna user_id em remarketing_executions não é nula
-- (pode ser nula em registros antigos caso a migração 068 tenha sido
--  aplicada antes do campo existir nos dados)
alter table public.remarketing_executions
  alter column user_id set not null;

-- RPC: incrementa total_sent atomicamente numa campanha
-- Usado pelo cron para contabilizar envios sem race condition.
create or replace function public.increment_campaign_sent(
  p_campaign_id uuid,
  p_count       int default 1
)
returns void
language sql security invoker set search_path = public as $$
  update public.remarketing_campaigns
  set
    total_sent  = total_sent + p_count,
    last_run_at = now()
  where id = p_campaign_id;
$$;

grant execute on function public.increment_campaign_sent(uuid, int) to authenticated;
-- O cron usa createAdminClient (service role) que bypassa grants,
-- mas o grant é necessário caso a função seja chamada por server actions.
