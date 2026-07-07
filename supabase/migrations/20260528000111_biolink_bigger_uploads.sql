-- Migração 111 — Aumenta o limite de upload do Bio Link
-- O bucket bio-avatars foi criado com 2 MB (mig 089) e usa ON CONFLICT DO NOTHING,
-- então não atualiza sozinho. Aqui subimos o limite para 5 MB (avatar + fundo).

update storage.buckets
set file_size_limit  = 5242880,   -- 5 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'bio-avatars';
