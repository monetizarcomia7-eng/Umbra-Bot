-- Migração 108 — Biblioteca de Mídia
-- Guarda o file_id (específico do bot) de imagens/vídeos que o bot "viu" em um
-- canal privado onde é administrador. Permite reenviar mídia nos fluxos sem
-- hospedar externamente e sem o limite de 20 MB da URL (file_id vai até ~2 GB).

create table if not exists public.media_library (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  bot_id         uuid        not null references public.bots(id) on delete cascade,
  media_type     text        not null check (media_type in ('image', 'video')),
  file_id        text        not null,          -- id para reenviar (sendPhoto/sendVideo)
  thumb_file_id  text,                          -- miniatura (preview na biblioteca)
  file_unique_id text,                          -- estável entre file_id — usado para dedup
  caption        text,                          -- legenda do post no canal (se houver)
  width          integer,
  height         integer,
  duration       integer,                       -- segundos (vídeo)
  source_chat_id text,                          -- canal de origem
  created_at     timestamptz not null default now()
);

create index if not exists media_library_user_bot_idx
  on public.media_library (user_id, bot_id, created_at desc);

-- Dedup: o mesmo arquivo postado uma vez não deve duplicar por bot
create unique index if not exists media_library_dedup_idx
  on public.media_library (bot_id, file_unique_id)
  where file_unique_id is not null;

alter table public.media_library enable row level security;

drop policy if exists "media_library_owner" on public.media_library;
create policy "media_library_owner" on public.media_library
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
