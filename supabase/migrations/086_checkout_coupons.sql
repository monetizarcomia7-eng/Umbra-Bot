-- Migration 086: tabela de cupons de desconto por checkout
create table if not exists public.checkout_coupons (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  checkout_id  uuid        references public.checkouts(id) on delete cascade,
  code         text        not null,
  type         text        not null default 'percent'
                             check (type in ('percent', 'fixed')),
  value        numeric(10,2) not null default 0 check (value >= 0),
  max_uses     integer     check (max_uses is null or max_uses > 0),
  uses         integer     not null default 0,
  valid_until  timestamptz,
  active       boolean     not null default true,
  created_at   timestamptz not null default now(),
  -- Mesmo usuário não pode ter 2 cupons com o mesmo código
  constraint checkout_coupons_user_code_key unique (user_id, code)
);

alter table public.checkout_coupons enable row level security;

create policy "coupons_owner" on public.checkout_coupons
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists checkout_coupons_user_id_idx    on public.checkout_coupons (user_id);
create index if not exists checkout_coupons_checkout_id_idx on public.checkout_coupons (checkout_id);

-- RPC pública para validar e aplicar cupom (sem expor todos os campos)
-- Chamada pelo /api/checkout/pay (admin client) — não requer auth do comprador
create or replace function public.validate_and_apply_coupon(
  p_user_id   uuid,
  p_code      text,
  p_price     numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon record;
  v_discount numeric(10,2) := 0;
  v_final    numeric(10,2);
begin
  select * into v_coupon
    from checkout_coupons
   where user_id = p_user_id
     and lower(code) = lower(p_code)
     and active = true
   limit 1;

  if not found then
    return json_build_object('valid', false, 'error', 'Cupom inválido ou expirado.');
  end if;

  -- Verifica data de expiração
  if v_coupon.valid_until is not null and v_coupon.valid_until < now() then
    return json_build_object('valid', false, 'error', 'Cupom expirado.');
  end if;

  -- Verifica limite de uso
  if v_coupon.max_uses is not null and v_coupon.uses >= v_coupon.max_uses then
    return json_build_object('valid', false, 'error', 'Cupom atingiu o limite de usos.');
  end if;

  -- Calcula desconto
  if v_coupon.type = 'percent' then
    v_discount := round(p_price * (v_coupon.value / 100), 2);
  else
    v_discount := least(v_coupon.value, p_price);
  end if;

  v_final := greatest(0, p_price - v_discount);

  -- Incrementa uso (atômico)
  update checkout_coupons
     set uses = uses + 1
   where id = v_coupon.id;

  return json_build_object(
    'valid',    true,
    'coupon_id', v_coupon.id,
    'type',     v_coupon.type,
    'value',    v_coupon.value,
    'discount', v_discount,
    'final',    v_final
  );
end;
$$;

grant execute on function public.validate_and_apply_coupon to authenticated, anon;
