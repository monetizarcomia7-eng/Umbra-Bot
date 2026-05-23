-- ============================================================
-- Umbra Bot — Migração 097
-- Separa módulos/aulas do JSONB monolítico em tabelas relacionais:
--   course_modules  (id, course_id, title, order_num)
--   course_lessons  (id, module_id, course_id, title, description,
--                    duration_min, video_url, order_num)
-- Mantém o JSONB `modules` na tabela courses para compatibilidade
-- retroativa até todos os dados serem migrados.
-- ============================================================

-- ─── 1. Tabela course_modules ────────────────────────────────
create table if not exists public.course_modules (
  id         text        primary key default gen_random_uuid()::text,
  course_id  text        not null references public.courses(id) on delete cascade,
  title      text        not null default '',
  order_num  integer     not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists course_modules_course_idx
  on public.course_modules (course_id, order_num);

alter table public.course_modules enable row level security;

-- Somente leitura para usuários autenticados (dados gerenciados pelo admin)
drop policy if exists "modules_select" on public.course_modules;
create policy "modules_select" on public.course_modules
  for select using (auth.role() = 'authenticated');

-- ─── 2. Tabela course_lessons ────────────────────────────────
create table if not exists public.course_lessons (
  id           text        primary key default gen_random_uuid()::text,
  module_id    text        not null references public.course_modules(id) on delete cascade,
  course_id    text        not null references public.courses(id) on delete cascade,
  title        text        not null default '',
  description  text        not null default '',
  duration_min integer     not null default 5,
  video_url    text        not null default '',
  order_num    integer     not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists course_lessons_module_idx
  on public.course_lessons (module_id, order_num);
create index if not exists course_lessons_course_idx
  on public.course_lessons (course_id, order_num);

alter table public.course_lessons enable row level security;

-- Somente leitura para usuários autenticados
drop policy if exists "lessons_select" on public.course_lessons;
create policy "lessons_select" on public.course_lessons
  for select using (auth.role() = 'authenticated');

-- ─── 3. Ajuste na tabela course_progress ─────────────────────
-- Adiciona FK opcional lesson_id → course_lessons.id
-- (nullable porque o ID vem do JSONB para cursos antigos)
alter table public.course_progress
  add column if not exists lesson_db_id text references public.course_lessons(id) on delete set null;

-- ─── 4. RPC: get_course_with_modules ─────────────────────────
-- Retorna curso completo com módulos e aulas (tabelas relacionais).
-- Fallback: se não há módulos em tabela, retorna JSONB de `courses.modules`.
create or replace function public.get_course_with_modules(p_course_id text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with mods as (
    select
      cm.id,
      cm.title,
      cm.order_num,
      coalesce(
        json_agg(
          json_build_object(
            'id',           cl.id,
            'title',        cl.title,
            'description',  cl.description,
            'duration_min', cl.duration_min,
            'video_url',    cl.video_url,
            'order_num',    cl.order_num
          ) order by cl.order_num
        ) filter (where cl.id is not null),
        '[]'::json
      ) as lessons
    from public.course_modules cm
    left join public.course_lessons cl on cl.module_id = cm.id
    where cm.course_id = p_course_id
    group by cm.id, cm.title, cm.order_num
    order by cm.order_num
  ),
  has_relational as (
    select count(*) > 0 as val from mods
  )
  select
    case
      when (select val from has_relational) then
        json_build_object(
          'source', 'relational',
          'modules', (select json_agg(row_to_json(mods.*)) from mods)
        )
      else
        json_build_object(
          'source', 'jsonb',
          'modules', (select modules from public.courses where id = p_course_id)
        )
    end;
$$;

grant execute on function public.get_course_with_modules(text) to authenticated;

-- ─── 5. RPC: import_course_modules_from_jsonb ────────────────
-- Utilitário admin: migra o JSONB de um curso para as tabelas relacionais.
-- Chamada manualmente ou via script de seed.
create or replace function public.import_course_modules_from_jsonb(p_course_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_modules    jsonb;
  v_module     jsonb;
  v_lesson     jsonb;
  v_module_id  text;
  v_lesson_id  text;
  v_m_order    integer := 0;
  v_l_order    integer;
  v_mod_count  integer := 0;
  v_les_count  integer := 0;
begin
  select modules into v_modules from public.courses where id = p_course_id;

  for v_module in select * from jsonb_array_elements(v_modules)
  loop
    insert into public.course_modules (course_id, title, order_num)
    values (p_course_id, v_module->>'title', v_m_order)
    returning id into v_module_id;

    v_l_order := 0;
    for v_lesson in select * from jsonb_array_elements(v_module->'lessons')
    loop
      insert into public.course_lessons (module_id, course_id, title, description, duration_min, video_url, order_num)
      values (
        v_module_id,
        p_course_id,
        coalesce(v_lesson->>'title', ''),
        coalesce(v_lesson->>'description', ''),
        coalesce((v_lesson->>'duration_min')::integer, 5),
        coalesce(v_lesson->>'video_url', ''),
        v_l_order
      )
      returning id into v_lesson_id;

      v_l_order  := v_l_order  + 1;
      v_les_count := v_les_count + 1;
    end loop;

    v_m_order  := v_m_order  + 1;
    v_mod_count := v_mod_count + 1;
  end loop;

  return json_build_object(
    'modules_imported', v_mod_count,
    'lessons_imported', v_les_count
  );
end;
$$;

-- Somente service role pode importar (admin)
-- (sem grant to authenticated)
