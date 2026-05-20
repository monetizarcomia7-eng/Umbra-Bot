-- ============================================================
-- Umbra Bot — Migration 072: Contacts — corrige índice único
--
-- Problema: a migração 034 criava um índice PARCIAL em
--   (bot_id, telegram_id) WHERE bot_id IS NOT NULL AND telegram_id IS NOT NULL
--
-- O PostgREST exige um índice/constraint COMPLETO (sem WHERE) para
-- que o ON CONFLICT (col1, col2) funcione no upsert.
-- Com o índice parcial, o upsert do webhook falha silenciosamente
-- e nenhum contato é criado.
--
-- Fix: substitui pelo índice completo.
-- Em PostgreSQL, NULL ≠ NULL, então múltiplas linhas com bot_id=NULL
-- ou telegram_id=NULL continuam sendo permitidas sem violar o índice.
-- ============================================================

-- Remove o índice parcial problemático
DROP INDEX IF EXISTS public.contacts_bot_telegram_udx;

-- Recria como índice completo (sem cláusula WHERE)
-- PostgreSQL trata NULL como valores distintos → sem risco de violar
-- unicidade para linhas com bot_id = NULL ou telegram_id = NULL
CREATE UNIQUE INDEX IF NOT EXISTS contacts_bot_telegram_udx
  ON public.contacts (bot_id, telegram_id);
