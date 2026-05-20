-- ============================================================
-- Umbra Bot — Migration 073: Contacts — UNIQUE CONSTRAINT real
--
-- Problema: a migration 072 criou um UNIQUE INDEX, mas o
-- PostgREST exige um UNIQUE CONSTRAINT (entrada em pg_constraint)
-- para que ON CONFLICT (col1,col2) funcione no upsert.
-- Com apenas um índice, o upsert do webhook continua falhando
-- silenciosamente → contacts nunca são criados.
--
-- A mesma situação foi corrigida para notification_prefs na
-- migration 061 com a mesma abordagem: substituir índice por
-- CONSTRAINT.
--
-- Fix:
--   1. Garante colunas de bot (migration 034 pode não ter rodado)
--   2. Remove qualquer índice existente pelo nome
--   3. Adiciona UNIQUE CONSTRAINT real (cria índice implícito)
-- ============================================================

-- 1. Garante colunas adicionadas pela migration 034
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS bot_id     uuid REFERENCES public.bots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS username   text,
  ADD COLUMN IF NOT EXISTS language   text NOT NULL DEFAULT 'pt';

-- Garante que name tem default '' (upsert do webhook não fornece name)
ALTER TABLE public.contacts ALTER COLUMN name SET DEFAULT '';

-- 2. Remove índices pelo nome (parcial da 034 e/ou completo da 072)
DROP INDEX IF EXISTS contacts_bot_telegram_udx;

-- 3. Remove constraint anterior (idempotente)
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_bot_telegram_key;

-- 4. Adiciona UNIQUE CONSTRAINT (obrigatório para ON CONFLICT no PostgREST)
-- NULL != NULL no PostgreSQL → linhas com bot_id=NULL ou telegram_id=NULL
-- continuam sendo permitidas sem conflito
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_bot_telegram_key
  UNIQUE (bot_id, telegram_id);
