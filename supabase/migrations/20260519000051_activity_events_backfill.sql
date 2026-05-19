-- ============================================================
-- Umbra Bot — activity_events: backfill de dados históricos
--
-- Popula activity_events com eventos passados de:
--   1. Transações aprovadas  → type='sale'
--   2. Reembolsos/cancelados → type='refund'
--   3. Contatos existentes   → type='lead'
--
-- Idempotente: NOT EXISTS evita duplicatas mesmo se rodar 2x.
-- A proximidade de 1s no created_at é suficiente pois cada
-- transação/contato tem um timestamp único.
-- ============================================================

-- 1. Vendas aprovadas
insert into public.activity_events
  (user_id, type, title, description, bot_id, amount, created_at)
select
  t.user_id,
  'sale',
  'Nova venda — ' || coalesce(nullif(t.product_name, ''), 'Produto'),
  coalesce(t.customer_name, 'Cliente')
    || ' · R$ '
    || to_char(coalesce(t.net, t.amount), 'FM999G999G990D00'),
  t.bot_id,
  coalesce(t.net, t.amount),
  t.created_at
from public.transactions t
where t.status = 'approved'
  and t.user_id is not null
  and not exists (
    select 1 from public.activity_events ae
    where ae.user_id = t.user_id
      and ae.type = 'sale'
      and abs(extract(epoch from (ae.created_at - t.created_at))) < 2
  );

-- 2. Reembolsos / cancelamentos
insert into public.activity_events
  (user_id, type, title, description, bot_id, amount, created_at)
select
  t.user_id,
  'refund',
  'Estorno — ' || coalesce(nullif(t.product_name, ''), 'Produto'),
  coalesce(t.customer_name, 'Cliente')
    || ' · R$ '
    || to_char(t.amount, 'FM999G999G990D00'),
  t.bot_id,
  t.amount,
  coalesce(t.updated_at, t.created_at)
from public.transactions t
where t.status in ('refunded', 'cancelled')
  and t.user_id is not null
  and not exists (
    select 1 from public.activity_events ae
    where ae.user_id = t.user_id
      and ae.type = 'refund'
      and abs(extract(epoch from (ae.created_at - coalesce(t.updated_at, t.created_at)))) < 2
  );

-- 3. Leads — contatos já cadastrados via webhook Telegram
insert into public.activity_events
  (user_id, type, title, description, bot_id, contact_id, created_at)
select
  c.user_id,
  'lead',
  'Novo lead',
  coalesce(
    nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''),
    nullif(c.name, ''),
    'Usuário'
  ) || ' iniciou conversa',
  c.bot_id,
  c.id,
  coalesce(c.first_contact, c.created_at)
from public.contacts c
where c.user_id is not null
  and not exists (
    select 1 from public.activity_events ae
    where ae.user_id = c.user_id
      and ae.type = 'lead'
      and abs(extract(epoch from (ae.created_at - coalesce(c.first_contact, c.created_at)))) < 2
  );

-- Relatório do que foi inserido
do $$
declare
  n_sales   int;
  n_refunds int;
  n_leads   int;
begin
  select count(*) into n_sales   from public.activity_events where type = 'sale';
  select count(*) into n_refunds from public.activity_events where type = 'refund';
  select count(*) into n_leads   from public.activity_events where type = 'lead';
  raise notice 'activity_events backfill: % vendas, % estornos, % leads', n_sales, n_refunds, n_leads;
end $$;
