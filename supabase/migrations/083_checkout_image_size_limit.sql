-- Migration 083: aumenta limite de tamanho de imagem do checkout de 2 MB para 10 MB
update storage.buckets
set file_size_limit = 10485760  -- 10 MB
where id = 'checkout-images';
