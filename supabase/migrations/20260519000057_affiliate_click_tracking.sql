-- ============================================================
-- Umbra Bot — affiliate click tracking (migration 057)
--
-- Adiciona redirect_url em affiliate_config
-- Cria track_affiliate_click(p_slug) — security definer:
--   · busca afiliado ativo pelo slug
--   · verifica se o programa está ativo
--   · incrementa clicks atomicamente
--   · retorna dados para o cookie de atribuição (cookie_window, redirect_url)
-- ============================================================

alter table public.affiliate_config
  add column if not exists redirect_url text;

-- ── Função pública de rastreamento de clique ─────────────────

create or replace function public.track_affiliate_click(p_slug text)
returns json language plpgsql security definer set search_path = public
as $$
declare
  v_aff_id      uuid;
  v_user_id     uuid;
  v_cookie_win  int     := 30;
  v_redirect    text    := null;
  v_active      boolean := true;
begin
  -- Busca afiliado ativo pelo slug (case-sensitive — slugs são gerados em minúsculas)
  select id, user_id
  into   v_aff_id, v_user_id
  from   public.affiliates
  where  slug = p_slug and status = 'active'
  limit  1;

  if not found then
    return json_build_object('found', false);
  end if;

  -- Busca configuração do programa (LEFT JOIN — pode não existir)
  select coalesce(ac.cookie_window, 30),
         ac.redirect_url,
         coalesce(ac.active, true)
  into   v_cookie_win, v_redirect, v_active
  from   public.affiliate_config ac
  where  ac.user_id = v_user_id;

  -- Programa fechado: não registra o clique
  if v_active = false then
    return json_build_object('found', false);
  end if;

  -- Incrementa cliques atomicamente (sem race condition)
  update public.affiliates
  set    clicks = clicks + 1
  where  id = v_aff_id;

  return json_build_object(
    'found',        true,
    'affiliate_id', v_aff_id,
    'cookie_window', v_cookie_win,
    'redirect_url', coalesce(v_redirect, '')
  );
end;
$$;

grant execute on function public.track_affiliate_click to anon, authenticated;
