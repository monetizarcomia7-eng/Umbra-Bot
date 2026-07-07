-- Migração 110 — Aparência premium do Bio Link
-- Adiciona: imagem de fundo, escolha de fonte, ícones sociais no topo e selo verificado.

alter table public.biolinks
  add column if not exists bg_image     text,                       -- URL da imagem de fundo (opcional)
  add column if not exists font_family  text    not null default 'sans',
  add column if not exists social_icons jsonb   not null default '[]'::jsonb,  -- [{platform,url}]
  add column if not exists verified     boolean not null default false;

comment on column public.biolinks.bg_image     is 'URL pública da imagem de fundo (null = usa o tema)';
comment on column public.biolinks.font_family  is 'sans|serif|rounded|mono|display';
comment on column public.biolinks.social_icons is 'Array JSON de { platform, url } exibido como barra de ícones no topo';
comment on column public.biolinks.verified     is 'Exibe selo verificado ao lado do nome';
