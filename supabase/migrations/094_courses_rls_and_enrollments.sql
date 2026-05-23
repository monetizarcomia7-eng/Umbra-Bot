-- ============================================================
-- Umbra Bot — Migração 094
-- Corrige RLS da tabela courses (somente leitura para usuários)
-- Cria tabela course_enrollments (relação usuário ↔ curso)
-- ============================================================

-- ─── 1. Fix RLS na tabela courses ───────────────────────────
-- Remove policy aberta (qualquer autenticado podia INSERT/UPDATE/DELETE cursos)
drop policy if exists "courses_open" on public.courses;

-- SELECT: qualquer usuário autenticado pode ler cursos publicados
create policy "courses_select" on public.courses
  for select using (auth.role() = 'authenticated');

-- INSERT/UPDATE/DELETE: apenas service role (admin) pode gerenciar cursos
-- (sem policy → implicitamente negado para authenticated)

-- ─── 2. Tabela course_enrollments ───────────────────────────
create table if not exists public.course_enrollments (
  user_id      uuid        not null references auth.users(id)   on delete cascade,
  course_id    text        not null references public.courses(id) on delete cascade,
  enrolled_at  timestamptz not null default now(),
  primary key (user_id, course_id)
);

create index if not exists course_enrollments_user_idx
  on public.course_enrollments (user_id);
create index if not exists course_enrollments_course_idx
  on public.course_enrollments (course_id);

alter table public.course_enrollments enable row level security;

-- Cada usuário vê e gerencia apenas suas próprias matrículas
drop policy if exists "enrollments_owner" on public.course_enrollments;
create policy "enrollments_owner" on public.course_enrollments
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── 3. RPC: enroll_in_course ───────────────────────────────
-- Matricula o usuário no curso (idempotente via ON CONFLICT)
create or replace function public.enroll_in_course(p_course_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.course_enrollments (user_id, course_id)
  values (auth.uid(), p_course_id)
  on conflict (user_id, course_id) do nothing;
end;
$$;

grant execute on function public.enroll_in_course(text) to authenticated;
