-- 077_pixels_improvements.sql
-- Adiciona pixel_code (TikTok Pixel Code distinto do Advertiser ID)
-- e last_test_at (timestamp do último evento de teste enviado)

alter table public.pixels
  add column if not exists pixel_code   text,
  add column if not exists last_test_at timestamptz;

comment on column public.pixels.pixel_code   is 'TikTok Pixel Code — distinto do Advertiser ID (pixel_id). Usado para envio de eventos via Events API.';
comment on column public.pixels.last_test_at is 'Timestamp do último evento de teste enviado via VerifyPixelModal. Usado para exibir histórico no card.';
