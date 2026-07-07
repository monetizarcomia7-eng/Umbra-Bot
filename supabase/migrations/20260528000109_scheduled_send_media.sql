-- Migração 109 — Mídia no agendamento de remarketing
-- Permite que o nó Remarketing dos fluxos anexe uma imagem/vídeo à mensagem.
-- O cron process-remarketing envia como sendPhoto/sendVideo quando presente.

alter table public.flow_scheduled_sends
  add column if not exists media_type text check (media_type in ('image', 'video')),
  add column if not exists media_ref  text;   -- file_id da Biblioteca de Mídia ou URL pública

comment on column public.flow_scheduled_sends.media_type is 'image|video — tipo de mídia anexada (null = só texto)';
comment on column public.flow_scheduled_sends.media_ref  is 'file_id (Telegram) ou URL pública da mídia';
