-- migration 099: contacts improvements
-- 1. notes column
-- 2. contacts_kpis RPC
-- 3. updated contacts_filter_options (origins + tags with counts + states)
-- 4. find_duplicate_contacts RPC

-- ── 1. notes column ──────────────────────────────────────────────────────────
alter table public.contacts
  add column if not exists notes text;

-- ── 2. contacts_kpis ─────────────────────────────────────────────────────────
create or replace function public.contacts_kpis(p_user_id uuid)
returns json language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'avg_ticket',
      coalesce(
        case when sum(purchases) > 0
          then round(sum(total_spent) / sum(purchases), 2)
          else 0
        end, 0),
    'ltv',             coalesce(sum(total_spent), 0),
    'new_30d',         count(*) filter (where first_contact >= now() - interval '30 days'),
    'new_prev_30d',    count(*) filter (where first_contact >= now() - interval '60 days'
                                         and first_contact <  now() - interval '30 days'),
    'conversion_rate',
      case when count(*) > 0
        then round(count(*) filter (where purchases > 0) * 100.0 / count(*), 1)
        else 0
      end
  )
  from public.contacts
  where user_id = p_user_id
$$;
grant execute on function public.contacts_kpis(uuid) to authenticated;

-- ── 3. updated contacts_filter_options (adds tags with counts + states) ──────
create or replace function public.contacts_filter_options(p_user_id uuid)
returns json language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'origins',
      coalesce(
        (select array_agg(distinct origin order by origin)
         from public.contacts
         where user_id = p_user_id and origin is not null and origin <> ''),
        '{}'::text[]),
    'tags',
      coalesce(
        (select json_agg(json_build_object('tag', t, 'count', cnt))
         from (
           select t, count(*) as cnt
           from public.contacts, unnest(tags) as t
           where user_id = p_user_id and t is not null and t <> ''
           group by t
           order by cnt desc, t
         ) sub),
        '[]'::json),
    'states',
      coalesce(
        (select array_agg(distinct state order by state)
         from public.contacts
         where user_id = p_user_id and state is not null and state <> ''),
        '{}'::text[])
  )
$$;
grant execute on function public.contacts_filter_options(uuid) to authenticated;

-- ── 4. find_duplicate_contacts ────────────────────────────────────────────────
create or replace function public.find_duplicate_contacts(
  p_user_id     uuid,
  p_contact_id  uuid,
  p_email       text  default null,
  p_phone       text  default null,
  p_telegram_id text  default null
)
returns table (id uuid, name text, email text, phone text, telegram_id text)
language sql stable security invoker set search_path = public as $$
  select id, name, email, phone, telegram_id
  from public.contacts
  where user_id = p_user_id
    and id <> p_contact_id
    and (
      (p_email       is not null and p_email       <> '' and email       = p_email)
      or (p_phone    is not null and p_phone       <> '' and phone       = p_phone)
      or (p_telegram_id is not null and p_telegram_id <> '' and telegram_id = p_telegram_id)
    )
  limit 5
$$;
grant execute on function public.find_duplicate_contacts(uuid, uuid, text, text, text) to authenticated;
