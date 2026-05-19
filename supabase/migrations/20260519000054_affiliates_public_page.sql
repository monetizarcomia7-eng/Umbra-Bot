-- ============================================================
-- Umbra Bot — Affiliates public page (migration 054)
--
-- 1. Adiciona status 'pending' (candidaturas pelo link público)
-- 2. RPC pública get_public_affiliate_program (sem auth, anon)
-- 3. RPC pública submit_affiliate_application (sem auth, anon)
-- ============================================================

-- ── 1. Expande status para incluir 'pending' ─────────────────

alter table public.affiliates drop constraint if exists affiliates_status_check;
alter table public.affiliates
  add constraint affiliates_status_check
  check (status in ('active', 'paused', 'archived', 'pending'));

-- ── 2. get_public_affiliate_program ─────────────────────────

create or replace function public.get_public_affiliate_program(p_user_id uuid)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'found',                  (ac.user_id is not null),
    'percentage',             coalesce(ac.percentage, 30),
    'cookie_window',          coalesce(ac.cookie_window, 30),
    'upsell_commissions',     coalesce(ac.upsell_commissions, true),
    'recurring_commissions',  coalesce(ac.recurring_commissions, false)
  )
  from (select 1) _dummy
  left join public.affiliate_config ac on ac.user_id = p_user_id
$$;

grant execute on function public.get_public_affiliate_program to anon, authenticated;

-- ── 3. submit_affiliate_application ─────────────────────────

create or replace function public.submit_affiliate_application(
  p_user_id uuid,
  p_name    text,
  p_email   text
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_slug text;
  v_pct  numeric;
begin
  -- Verifica se user_id existe
  if not exists (select 1 from auth.users where id = p_user_id) then
    return json_build_object('success', false, 'error', 'invalid_program');
  end if;

  -- Verifica duplicata (mesmo e-mail para o mesmo programa)
  if exists (
    select 1 from public.affiliates
     where user_id = p_user_id and lower(email) = lower(p_email)
  ) then
    return json_build_object('success', false, 'error', 'already_applied');
  end if;

  -- Gera slug a partir do nome (sem dependência de unaccent)
  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '^-|-$', '', 'g');
  if v_slug = '' then v_slug := 'afiliado'; end if;

  -- Garante unicidade do slug
  if exists (select 1 from public.affiliates where slug = v_slug) then
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  end if;

  -- Busca percentual do programa (fallback: 30%)
  select percentage into v_pct
    from public.affiliate_config
   where user_id = p_user_id;
  v_pct := coalesce(v_pct, 30);

  -- Insere candidatura como pendente
  insert into public.affiliates (
    user_id, name, email, slug, status,
    commission_pct, payment_method,
    clicks, sales, commission, conversion_rate
  ) values (
    p_user_id, p_name, lower(p_email), v_slug, 'pending',
    v_pct, 'Pix · ' || lower(p_email),
    0, 0, 0, 0
  );

  return json_build_object('success', true);
end;
$$;

grant execute on function public.submit_affiliate_application to anon, authenticated;
