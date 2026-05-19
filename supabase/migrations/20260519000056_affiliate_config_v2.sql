-- ============================================================
-- Umbra Bot — affiliate_config v2 (migration 056)
--
-- Adiciona ao affiliate_config:
--   program_name        text    — nome personalizado do programa
--   program_description text    — descrição exibida na página pública
--   benefits            text[]  — lista de benefícios personalizados
--   active              boolean — se o programa aceita novas candidaturas
--
-- Atualiza get_public_affiliate_program para retornar os novos campos.
-- ============================================================

alter table public.affiliate_config
  add column if not exists program_name        text,
  add column if not exists program_description text,
  add column if not exists benefits            text[] default array[]::text[],
  add column if not exists active              boolean not null default true;

-- ── Recria a função pública com os novos campos ──────────────

create or replace function public.get_public_affiliate_program(p_user_id uuid)
returns json language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'found',                 true,
    'active',                coalesce(ac.active, true),
    'program_name',          coalesce(ac.program_name, ''),
    'program_description',   coalesce(ac.program_description, ''),
    'benefits',              coalesce(ac.benefits, array[]::text[]),
    'percentage',            coalesce(ac.percentage, 30),
    'cookie_window',         coalesce(ac.cookie_window, 30),
    'upsell_commissions',    coalesce(ac.upsell_commissions, true),
    'recurring_commissions', coalesce(ac.recurring_commissions, false)
  )
  from auth.users u
  left join public.affiliate_config ac on ac.user_id = u.id
  where u.id = p_user_id
  limit 1;
$$;
