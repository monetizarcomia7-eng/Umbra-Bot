-- ============================================================
-- Umbra Bot — Função: track_checkout_event
--
-- Permite que páginas de checkout públicas registrem eventos no
-- funil de conversão sem autenticação de usuário (anon).
--
-- Por que security definer?
--   O endpoint POST /api/checkout/track não exige login do visitante.
--   A RLS de checkout_events exige auth.uid() = user_id — sem sessão
--   autenticada, qualquer INSERT via anon key seria bloqueado.
--   Com security definer, a função roda com os privilégios do owner
--   (postgres), que tem BYPASSRLS, e pode inserir o evento resolvendo
--   user_id internamente a partir do bot_id.
--
-- Segurança:
--   - event_type: allowlist restrita a eventos de visitante
--     ('visited', 'cart_added', 'payment_initiated').
--     'conversation_started' e 'paid' são inseridos server-side
--     (com auth real: Telegram webhook e MP webhook).
--   - user_id resolvido INTERNAMENTE via bot_id — não exposto ao caller.
--   - Bot inexistente → return silencioso (não vaza existência do bot).
--   - Grant restrito: anon + authenticated apenas (não service_role direta).
--
-- Populado por: POST /api/checkout/track (app/api/checkout/track/route.ts)
-- ============================================================

create or replace function public.track_checkout_event(
  p_bot_id       uuid,
  p_event_type   text,
  p_product_name text default '',
  p_flow_id      uuid default null,
  p_utm_source   text default null,
  p_utm_medium   text default null,
  p_utm_campaign text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  -- Allowlist: apenas eventos originados em páginas externas/visitantes
  if p_event_type not in ('visited', 'cart_added', 'payment_initiated') then
    raise exception 'event_type não permitido via tracking público: %', p_event_type;
  end if;

  -- Resolve user_id a partir do bot (nunca aceita user_id externo diretamente)
  select user_id into v_user_id
  from public.bots
  where id = p_bot_id;

  -- Bot inexistente → sai silenciosamente (não vaza existência)
  if v_user_id is null then
    return;
  end if;

  insert into public.checkout_events (
    user_id,
    bot_id,
    flow_id,
    event_type,
    product_name,
    utm_source,
    utm_medium,
    utm_campaign
  ) values (
    v_user_id,
    p_bot_id,
    p_flow_id,
    p_event_type,
    coalesce(p_product_name, ''),
    p_utm_source,
    p_utm_medium,
    p_utm_campaign
  );
end;
$$;

-- Callable por visitantes não autenticados (anon key) e usuários autenticados
grant execute
  on function public.track_checkout_event(uuid, text, text, uuid, text, text, text)
  to anon, authenticated;
