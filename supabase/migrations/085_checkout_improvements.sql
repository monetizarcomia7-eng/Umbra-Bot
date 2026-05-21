-- Migration 085: melhorias do checkout — order bump, logo imagem, 2 etapas, upsell, visitor tracking
alter table public.checkouts
  add column if not exists order_bump        jsonb,
  add column if not exists logo_image        text,
  add column if not exists two_step          boolean not null default false,
  add column if not exists upsell            jsonb,
  add column if not exists visitor_tracking  boolean not null default false;

comment on column public.checkouts.order_bump       is 'Produto adicional oferecido antes do pagamento: { title, desc, price, image }';
comment on column public.checkouts.logo_image       is 'URL da imagem do logo (prevalece sobre logo texto)';
comment on column public.checkouts.two_step         is 'Habilita checkout em 2 etapas: dados pessoais → pagamento';
comment on column public.checkouts.upsell           is 'Oferta exibida após pagamento confirmado: { title, desc, price, cta, link }';
comment on column public.checkouts.visitor_tracking is 'Exibe contador de visitantes ao vivo no checkout público';
