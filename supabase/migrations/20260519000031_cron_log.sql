-- ============================================================
-- Umbra Bot — Tabela de log do cron (cron_log)
--
-- Registra cada execução do cron job de saques:
-- quantos foram processados, quando, e se houve erro.
-- Sem RLS — só acessível via service role / admin.
-- ============================================================

create table if not exists public.cron_log (
  id              bigserial     primary key,
  job             text          not null,
  started_at      timestamptz   not null default now(),
  finished_at     timestamptz,
  processed       int           not null default 0,
  status          text          not null default 'running'
                    check (status in ('running', 'success', 'error')),
  error_message   text,
  metadata        jsonb
);

create index if not exists cron_log_job_idx        on public.cron_log (job, started_at desc);
create index if not exists cron_log_started_at_idx on public.cron_log (started_at desc);

alter table public.cron_log enable row level security;
-- Sem policy de select para usuários — cron_log é só para operação interna
