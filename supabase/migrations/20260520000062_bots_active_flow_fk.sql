-- ============================================================
-- Umbra Bot — bots: adiciona FK para active_flow_id
--
-- Sem esta FK, deletar um fluxo deixava active_flow_id com um
-- UUID dangling: a FlowTab não encontrava o fluxo no array e
-- mostrava "nenhum" mesmo com o campo preenchido no banco.
-- Com ON DELETE SET NULL, ao deletar o fluxo o campo é zerado
-- automaticamente e o bot fica sem fluxo vinculado.
-- ============================================================

alter table public.bots
  add constraint bots_active_flow_id_fk
  foreign key (active_flow_id)
  references public.flows(id)
  on delete set null;
