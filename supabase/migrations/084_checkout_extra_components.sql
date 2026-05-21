-- Migration 084: adiciona componentes extras e configurações de fundo ao checkout
alter table public.checkouts
  add column if not exists extra_components jsonb   not null default '[]'::jsonb,
  add column if not exists bg_image         text,
  add column if not exists bg_fixed         boolean not null default false,
  add column if not exists bg_repeat        boolean not null default false,
  add column if not exists bg_cover         boolean not null default true;
