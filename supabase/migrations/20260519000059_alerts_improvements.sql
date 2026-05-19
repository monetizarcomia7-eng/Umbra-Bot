-- migration 059: alerts_improvements
-- Adiciona colunas de rastreamento à tabela alerts:
--   resolved_by_id (UUID do usuário que resolveu)
--   source          (origem do alerta: 'cron', 'webhook', 'manual', etc.)
--   action_taken    (label da ação executada pelo usuário)
--   viewed_at       (quando o alerta foi visualizado pela primeira vez)
-- Trigger: auto-set resolved_at quando resolved muda para true
-- Índices de suporte para buscas comuns

alter table public.alerts
  add column if not exists resolved_by_id uuid references auth.users(id) on delete set null,
  add column if not exists source         text,
  add column if not exists action_taken   text,
  add column if not exists viewed_at      timestamptz;

-- Índice parcial: alertas ainda não visualizados (filtro mais frequente)
create index if not exists alerts_viewed_at_null_idx
  on public.alerts (user_id, created_at desc)
  where viewed_at is null;

-- Índice parcial: alertas não resolvidos (a visão default da aba)
create index if not exists alerts_unresolved_idx
  on public.alerts (user_id, created_at desc)
  where resolved = false;

-- Índice para filtrar por source
create index if not exists alerts_source_idx on public.alerts (source);

-- Trigger: garante consistência de resolved_at
-- • Ao resolver: preenche resolved_at automaticamente se não foi enviado pelo app
-- • Ao reabrir: limpa resolved_at (elimina inconsistência resolved=false + resolved_at preenchido)
create or replace function public.sync_alert_resolved_at()
returns trigger language plpgsql as $$
begin
  if NEW.resolved = true
    and (OLD.resolved = false or OLD.resolved is null)
    and NEW.resolved_at is null
  then
    NEW.resolved_at := now();
  end if;
  if NEW.resolved = false then
    NEW.resolved_at := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_alert_resolved_at on public.alerts;
create trigger trg_sync_alert_resolved_at
  before update on public.alerts
  for each row execute function public.sync_alert_resolved_at();
