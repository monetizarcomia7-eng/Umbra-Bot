-- ============================================================
-- Umbra Bot — Migração 096
-- Cria tabela course_certificates (certificados emitidos)
-- ============================================================

create table if not exists public.course_certificates (
  id              text        primary key default gen_random_uuid()::text,
  user_id         uuid        not null references auth.users(id)   on delete cascade,
  course_id       text        not null references public.courses(id) on delete cascade,
  issued_at       timestamptz not null default now(),
  certificate_url text,         -- URL do PDF/imagem do certificado (Storage ou externo)
  unique (user_id, course_id)   -- 1 certificado por usuário por curso
);

create index if not exists course_certificates_user_idx
  on public.course_certificates (user_id);

alter table public.course_certificates enable row level security;

drop policy if exists "certificates_owner" on public.course_certificates;
create policy "certificates_owner" on public.course_certificates
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── RPC: issue_certificate ──────────────────────────────────
-- Emite certificado se o usuário concluiu 100% das aulas do curso.
-- Retorna: { issued, certificate_id, already_existed }
create or replace function public.issue_certificate(p_course_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_lessons  integer;
  v_done_lessons   integer;
  v_cert_id        text;
  v_exists         boolean;
begin
  -- Conta aulas totais do curso via JSONB (modules[].lessons[])
  select coalesce(
    (select sum(jsonb_array_length(m -> 'lessons'))
     from public.courses c,
          jsonb_array_elements(c.modules) as m
     where c.id = p_course_id),
    0
  ) into v_total_lessons;

  -- Conta aulas concluídas pelo usuário nesse curso
  select count(*)
  into v_done_lessons
  from public.course_progress
  where user_id   = auth.uid()
    and course_id = p_course_id
    and done      = true;

  -- Verifica se o certificado já existe
  select id into v_cert_id
  from public.course_certificates
  where user_id   = auth.uid()
    and course_id = p_course_id;

  v_exists := (v_cert_id is not null);

  -- Só emite se 100% concluído e ainda não tem certificado
  if v_total_lessons > 0 and v_done_lessons >= v_total_lessons and not v_exists then
    insert into public.course_certificates (user_id, course_id)
    values (auth.uid(), p_course_id)
    returning id into v_cert_id;

    return json_build_object(
      'issued', true,
      'certificate_id', v_cert_id,
      'already_existed', false
    );
  elsif v_exists then
    return json_build_object(
      'issued', false,
      'certificate_id', v_cert_id,
      'already_existed', true
    );
  else
    return json_build_object(
      'issued', false,
      'certificate_id', null,
      'already_existed', false,
      'progress', v_done_lessons,
      'total', v_total_lessons
    );
  end if;
end;
$$;

grant execute on function public.issue_certificate(text) to authenticated;

-- ─── RPC: get_user_certificates ─────────────────────────────
-- Retorna todos os certificados do usuário logado com dados do curso
create or replace function public.get_user_certificates()
returns table (
  certificate_id   text,
  course_id        text,
  course_title     text,
  course_subtitle  text,
  issued_at        timestamptz,
  certificate_url  text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cc.id          as certificate_id,
    c.id           as course_id,
    c.title        as course_title,
    c.subtitle     as course_subtitle,
    cc.issued_at,
    cc.certificate_url
  from public.course_certificates cc
  join public.courses c on c.id = cc.course_id
  where cc.user_id = auth.uid()
  order by cc.issued_at desc;
$$;

grant execute on function public.get_user_certificates() to authenticated;
