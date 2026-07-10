-- ─────────────────────────────────────────────────────────────────────────────
-- Migração 114 — Entregável (delivery) nos fluxos de venda
--
-- Liga o pagamento (transactions) de volta ao nó de Pix do fluxo, para que a
-- entrega automática (link/convite) só aconteça DEPOIS do pagamento confirmado.
--
-- Colunas novas em transactions:
--   flow_node_id   → id do nó de Pix que gerou a cobrança (para retomar o fluxo)
--   flow_version   → versão (snapshot) do fluxo em que a cobrança nasceu
--   flow_delivered → trava de idempotência: garante entrega uma única vez,
--                    mesmo que webhook do MP + clique em "Verificar Status"
--                    disparem ao mesmo tempo.
--   contact_id     → já existe (migração 052); reforçado com IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.transactions
  add column if not exists contact_id     uuid references public.contacts(id) on delete set null,
  add column if not exists flow_node_id   text,
  add column if not exists flow_version   integer,
  add column if not exists flow_delivered boolean not null default false;

-- Índice para o resume pós-pagamento (só linhas de fluxo ainda não entregues).
create index if not exists transactions_flow_delivery_idx
  on public.transactions (id)
  where flow_node_id is not null and flow_delivered = false;

comment on column public.transactions.flow_node_id   is 'Nó de Pix do fluxo que originou a cobrança (retomada pós-pagamento).';
comment on column public.transactions.flow_version   is 'Versão do snapshot do fluxo no momento da cobrança.';
comment on column public.transactions.flow_delivered is 'Trava de idempotência da entrega automática (Entregável).';
