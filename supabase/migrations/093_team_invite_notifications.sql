-- ============================================================
-- Umbra Bot — Convites de equipe com notificações in-app
-- 1. Extende alerts.type CHECK para incluir 'team_invite'
-- 2. RPC invite_team_member   — insere convite + cria alerta para o convidado
-- 3. RPC get_pending_invites_for_user — lista convites pendentes por e-mail
-- 4. RPC accept_team_invite   — aceita convite (status 'active') + resolve alerta
-- 5. RPC reject_team_invite   — recusa convite (DELETE) + resolve alerta
-- ============================================================

-- === 1. Extende o CHECK constraint de alerts.type ===
alter table public.alerts drop constraint if exists alerts_type_check;
alter table public.alerts add constraint alerts_type_check
  check (type in (
    'gateway_fail', 'bot_banned', 'bot_offline', 'send_quota',
    'webhook_fail', 'payment_pending', 'limit_warning', 'ssl_expiring',
    'sale', 'webhookFailed', 'team_invite'
  ));

-- === 2. RPC invite_team_member ===
-- Insere o registro em team_members (status='invited') e, se o convidado já
-- tiver uma conta, cria um alerta do tipo 'team_invite' para ele.
create or replace function public.invite_team_member(
  p_owner_id  uuid,
  p_id        text,
  p_name      text,
  p_email     text,
  p_avatar    text,
  p_color     text,
  p_role      text,
  p_joined_at bigint
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitee_id uuid;
  v_owner_name text;
begin
  -- Verifica que o chamador é o dono (extra check, RLS já cobre)
  if auth.uid() <> p_owner_id then
    return json_build_object('ok', false, 'error', 'unauthorized');
  end if;

  -- Insere o convite em team_members
  insert into public.team_members (
    id, user_id, name, email, avatar, color, role, status, last_seen, joined_at, self
  ) values (
    p_id, p_owner_id, p_name, p_email, p_avatar, p_color, p_role,
    'invited', null, p_joined_at, false
  );

  -- Tenta encontrar o usuário convidado por e-mail no auth.users
  select id into v_invitee_id
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;

  -- Se o convidado tem conta, cria alerta in-app para ele
  if v_invitee_id is not null then
    -- Busca nome do dono para exibir no alerta
    select coalesce(name, '') into v_owner_name
    from public.profiles
    where id = p_owner_id;

    insert into public.alerts (
      user_id, type, severity, title, description,
      context, resolved, source
    ) values (
      v_invitee_id,
      'team_invite',
      'info',
      'Convite de equipe recebido',
      format('Você foi convidado por %s para colaborar no workspace deles como %s.',
        case when v_owner_name <> '' then v_owner_name else 'um usuário' end,
        p_role
      ),
      json_build_array(
        json_build_object('icon', 'users', 'label', p_role),
        json_build_object('icon', 'mail',  'label', p_email)
      )::jsonb,
      false,
      'team_invite:' || p_id  -- armazena o invite id para lookup posterior
    );
  end if;

  return json_build_object('ok', true, 'invite_id', p_id);
end;
$$;

grant execute on function public.invite_team_member(uuid,text,text,text,text,text,text,bigint) to authenticated;

-- === 3. RPC get_pending_invites_for_user ===
-- Retorna convites pendentes (status='invited') direcionados ao e-mail do usuário,
-- junto com informações do dono (nome + avatar).
create or replace function public.get_pending_invites_for_user(
  p_email text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_agg(row_to_json(r))
  into v_result
  from (
    select
      tm.id,
      tm.user_id   as owner_id,
      tm.role,
      tm.joined_at,
      coalesce(pr.name, '')        as owner_name,
      coalesce(pr.avatar_color, '#7c3aed') as owner_color,
      coalesce(pr.avatar_initials, '')     as owner_initials,
      coalesce(pr.workspace, '')   as owner_workspace
    from public.team_members tm
    left join public.profiles pr on pr.id = tm.user_id
    where lower(tm.email) = lower(p_email)
      and tm.status = 'invited'
    order by tm.joined_at asc
  ) r;

  return coalesce(v_result, '[]'::json);
end;
$$;

grant execute on function public.get_pending_invites_for_user(text) to authenticated;

-- === 4. RPC accept_team_invite ===
-- Muda status para 'active' e resolve o alerta correspondente.
create or replace function public.accept_team_invite(
  p_invite_id text,
  p_user_id   uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.team_members%rowtype;
  v_user_email text;
begin
  -- Busca o e-mail do usuário
  select lower(email) into v_user_email
  from auth.users
  where id = p_user_id
  limit 1;

  -- Busca e valida o convite
  select * into v_invite
  from public.team_members
  where id = p_invite_id
    and lower(email) = v_user_email
    and status = 'invited';

  if not found then
    return json_build_object('ok', false, 'error', 'invite_not_found');
  end if;

  -- Aceita o convite
  update public.team_members
  set status = 'active', last_seen = extract(epoch from now())::bigint * 1000
  where id = p_invite_id;

  -- Resolve o alerta correspondente (se existir)
  update public.alerts
  set
    resolved    = true,
    resolved_at = now(),
    resolved_by = 'aceito pelo convidado'
  where user_id = p_user_id
    and type = 'team_invite'
    and source = 'team_invite:' || p_invite_id
    and resolved = false;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.accept_team_invite(text, uuid) to authenticated;

-- === 5. RPC reject_team_invite ===
-- Remove o registro de team_members e resolve o alerta.
create or replace function public.reject_team_invite(
  p_invite_id text,
  p_user_id   uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_email text;
begin
  -- Busca o e-mail do usuário
  select lower(email) into v_user_email
  from auth.users
  where id = p_user_id
  limit 1;

  -- Valida que o convite pertence a esse e-mail
  if not exists (
    select 1 from public.team_members
    where id = p_invite_id
      and lower(email) = v_user_email
      and status = 'invited'
  ) then
    return json_build_object('ok', false, 'error', 'invite_not_found');
  end if;

  -- Remove o convite
  delete from public.team_members where id = p_invite_id;

  -- Resolve o alerta
  update public.alerts
  set
    resolved    = true,
    resolved_at = now(),
    resolved_by = 'recusado pelo convidado'
  where user_id = p_user_id
    and type = 'team_invite'
    and source = 'team_invite:' || p_invite_id
    and resolved = false;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.reject_team_invite(text, uuid) to authenticated;
