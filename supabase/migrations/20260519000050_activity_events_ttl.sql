-- ============================================================
-- Umbra Bot — activity_events: TTL via pg_cron (opcional)
--
-- Esta migration é defensiva: só executa se pg_cron estiver
-- habilitado no Supabase (Dashboard → Database → Extensions).
-- Se não estiver, não faz nada e não gera erro.
--
-- A abordagem PRIMÁRIA deste projeto usa o Vercel Cron:
--   GET /api/cron/cleanup-activity — todo dia às 02:00 UTC
-- ============================================================

do $$
begin
  -- Só prossegue se o schema 'cron' (pg_cron) existir
  if not exists (
    select 1 from information_schema.schemata where schema_name = 'cron'
  ) then
    raise notice 'pg_cron não está habilitado — migration 050 ignorada. '
                 'Habilite em: Dashboard → Database → Extensions → pg_cron';
    return;
  end if;

  -- Remove job anterior se existir (idempotente)
  if exists (select 1 from cron.job where jobname = 'cleanup-activity-events') then
    perform cron.unschedule('cleanup-activity-events');
  end if;

  -- Agenda limpeza diária às 03:00 UTC (1h após o Vercel Cron às 02:00)
  perform cron.schedule(
    'cleanup-activity-events',
    '0 3 * * *',
    'delete from public.activity_events where created_at < now() - interval ''90 days'''
  );

  raise notice 'pg_cron: job cleanup-activity-events agendado com sucesso.';
end $$;
