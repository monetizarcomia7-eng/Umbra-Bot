-- Umbra Bot — checkout principal do produto
alter table public.products
  add column if not exists default_checkout_id text references public.checkouts(id) on delete set null;

create index if not exists products_default_checkout_id_idx
  on public.products (default_checkout_id)
  where default_checkout_id is not null;
