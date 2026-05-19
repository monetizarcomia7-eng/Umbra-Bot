-- ============================================================
-- Umbra Bot — Tabela: checkout_events
--
-- Rastreia cada etapa do funil de conversão:
--   visited             → usuário visitou a página do checkout/produto
--   conversation_started → iniciou conversa com o bot
--   cart_added          → adicionou produto ao carrinho
--   payment_initiated   → gerou o PIX / tentou pagar
--   paid                → pagamento aprovado (espelha transactions.status='approved')
--
-- Popular via:
--   - Webhook Telegram: insere 'conversation_started' ao /start
--   - Rota PIX (api/payments/pix): insere 'cart_added' ao gerar cobrança
--   - Webhook MP: insere 'paid' ao confirmar aprovação
--   - Páginas de checkout públicas: insere 'visited' via JS
-- ============================================================

create table if not exists public.checkout_events (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  bot_id         uuid        references public.bots(id) on delete set null,
  flow_id        uuid        references public.flows(id) on delete set null,
  contact_id     uuid        references public.contacts(id) on delete set null,
  transaction_id uuid        references public.transactions(id) on delete set null,
  event_type     text        not null
                   check (event_type in (
                     'visited',
                     'conversation_started',
                     'cart_added',
                     'payment_initiated',
                     'paid'
                   )),
  product_name   text        not null default '',
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  metadata       jsonb       not null default '{}',
  created_at     timestamptz not null default now()
);

-- Índices para as queries de analytics
create index if not exists checkout_events_user_id_idx
  on public.checkout_events (user_id);

create index if not exists checkout_events_event_type_idx
  on public.checkout_events (event_type);

create index if not exists checkout_events_created_at_idx
  on public.checkout_events (created_at desc);

create index if not exists checkout_events_bot_id_idx
  on public.checkout_events (bot_id)
  where bot_id is not null;

create index if not exists checkout_events_flow_id_idx
  on public.checkout_events (flow_id)
  where flow_id is not null;

-- Índice composto para a query principal do analytics (user + tipo + data)
create index if not exists checkout_events_user_event_date_idx
  on public.checkout_events (user_id, event_type, created_at desc);

alter table public.checkout_events enable row level security;

create policy "checkout_events_owner" on public.checkout_events
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
