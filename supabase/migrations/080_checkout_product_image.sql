-- Migration 080: imagem do produto no checkout
-- Adiciona coluna product_image à tabela checkouts
alter table public.checkouts
  add column if not exists product_image text;

-- Bucket público para imagens de produto dos checkouts
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checkout-images',
  'checkout-images',
  true,
  2097152,  -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Políticas de storage
-- Upload: apenas o próprio usuário (pasta = userId)
create policy "checkout_images_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'checkout-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Leitura pública (imagens são exibidas no checkout público sem auth)
create policy "checkout_images_select"
  on storage.objects for select
  using (bucket_id = 'checkout-images');

-- Substituição: apenas o próprio usuário
create policy "checkout_images_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'checkout-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Remoção: apenas o próprio usuário
create policy "checkout_images_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'checkout-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
