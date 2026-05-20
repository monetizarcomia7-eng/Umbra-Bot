-- ============================================================
-- Umbra Bot — Migração 064: estado de execução de fluxo em contacts
-- Permite que o webhook saiba em qual nó do fluxo o contato está
-- ============================================================

alter table public.contacts
  add column if not exists flow_id      uuid references public.flows(id) on delete set null,
  add column if not exists flow_node_id text,
  add column if not exists flow_vars    jsonb not null default '{}';

create index if not exists contacts_flow_id_idx on public.contacts (flow_id) where flow_id is not null;

comment on column public.contacts.flow_id      is 'ID do fluxo ativo para este contato';
comment on column public.contacts.flow_node_id is 'Nó do fluxo aguardando resposta do contato (null = sem espera ativa)';
comment on column public.contacts.flow_vars    is 'Variáveis capturadas pelo fluxo (ex: {"nome": "João", "email": "j@x.com"})';
