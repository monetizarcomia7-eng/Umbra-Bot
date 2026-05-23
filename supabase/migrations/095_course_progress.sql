-- ============================================================
-- Umbra Bot — Migração 095
-- Cria tabela course_progress (progresso por aula por usuário)
-- ============================================================

create table if not exists public.course_progress (
  user_id      uuid        not null references auth.users(id)   on delete cascade,
  course_id    text        not null references public.courses(id) on delete cascade,
  lesson_id    text        not null,   -- ID da aula dentro do JSONB modules
  done         boolean     not null default false,
  watched_sec  integer     not null default 0,  -- segundos assistidos
  done_at      timestamptz,                     -- quando marcou como concluída
  updated_at   timestamptz not null default now(),
  primary key (user_id, course_id, lesson_id)
);

create index if not exists course_progress_user_course_idx
  on public.course_progress (user_id, course_id);

alter table public.course_progress enable row level security;

drop policy if exists "progress_owner" on public.course_progress;
create policy "progress_owner" on public.course_progress
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger: atualiza updated_at automaticamente
create or replace trigger course_progress_updated_at
  before update on public.course_progress
  for each row execute function public.set_updated_at();

-- ─── RPC: upsert_lesson_progress ────────────────────────────
-- Persiste progresso de uma aula (done flag + segundos assistidos)
-- Matricula automaticamente no curso se ainda não estiver
create or replace function public.upsert_lesson_progress(
  p_course_id   text,
  p_lesson_id   text,
  p_done        boolean,
  p_watched_sec integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Garante que o usuário está matriculado
  insert into public.course_enrollments (user_id, course_id)
  values (auth.uid(), p_course_id)
  on conflict (user_id, course_id) do nothing;

  -- Upsert do progresso da aula
  insert into public.course_progress (user_id, course_id, lesson_id, done, watched_sec, done_at)
  values (
    auth.uid(),
    p_course_id,
    p_lesson_id,
    p_done,
    p_watched_sec,
    case when p_done then now() else null end
  )
  on conflict (user_id, course_id, lesson_id) do update
    set done        = excluded.done,
        watched_sec = greatest(course_progress.watched_sec, excluded.watched_sec),
        done_at     = case
                        when excluded.done and course_progress.done_at is null then now()
                        when not excluded.done then null
                        else course_progress.done_at
                      end,
        updated_at  = now();
end;
$$;

grant execute on function public.upsert_lesson_progress(text, text, boolean, integer) to authenticated;

-- ─── RPC: get_course_progress ────────────────────────────────
-- Retorna o progresso completo de um usuário em um curso
create or replace function public.get_course_progress(p_course_id text)
returns table (
  lesson_id    text,
  done         boolean,
  watched_sec  integer,
  done_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select lesson_id, done, watched_sec, done_at
  from public.course_progress
  where user_id = auth.uid()
    and course_id = p_course_id;
$$;

grant execute on function public.get_course_progress(text) to authenticated;
