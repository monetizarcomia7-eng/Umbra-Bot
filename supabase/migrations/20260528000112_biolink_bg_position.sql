-- Migração 112 — Enquadramento da imagem de fundo do Bio Link
-- Guarda qual parte da imagem aparece (object-position), já que o fundo é
-- cortado (cover) para preencher a tela. Formato: "50% 50%" (X% Y%) ou 'center'.

alter table public.biolinks
  add column if not exists bg_position text not null default 'center';

comment on column public.biolinks.bg_position is 'Enquadramento da imagem de fundo (object-position), ex: "50% 30%"';
