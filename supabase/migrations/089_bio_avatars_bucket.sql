-- 089_bio_avatars_bucket.sql
-- Cria bucket público bio-avatars para upload de avatares de Bio Link

-- 1. Criar bucket (idempotente via ON CONFLICT)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bio-avatars',
  'bio-avatars',
  true,
  2097152,  -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- 2. RLS: qualquer um pode ler (bucket público)
do $$ begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage'
       and tablename  = 'objects'
       and policyname = 'bio_avatars_select'
  ) then
    create policy "bio_avatars_select" on storage.objects
      for select using (bucket_id = 'bio-avatars');
  end if;
end $$;

-- 3. RLS: apenas o dono da pasta (user_id/) pode fazer upload
do $$ begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage'
       and tablename  = 'objects'
       and policyname = 'bio_avatars_insert'
  ) then
    create policy "bio_avatars_insert" on storage.objects
      for insert with check (
        bucket_id = 'bio-avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

-- 4. RLS: apenas o dono da pasta pode atualizar (upsert)
do $$ begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage'
       and tablename  = 'objects'
       and policyname = 'bio_avatars_update'
  ) then
    create policy "bio_avatars_update" on storage.objects
      for update using (
        bucket_id = 'bio-avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

-- 5. RLS: apenas o dono da pasta pode deletar
do $$ begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage'
       and tablename  = 'objects'
       and policyname = 'bio_avatars_delete'
  ) then
    create policy "bio_avatars_delete" on storage.objects
      for delete using (
        bucket_id = 'bio-avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;
