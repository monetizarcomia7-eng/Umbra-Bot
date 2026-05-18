-- ============================================================
-- Storage bucket for avatars + push_subscriptions table
-- ============================================================

-- Avatar storage bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to avatars bucket
create policy "avatars_upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_select" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Push subscriptions table
create table if not exists public.push_subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade unique,
  subscription jsonb      not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_self" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Broadcasts: add missing columns if table already exists from migration 021
alter table public.broadcasts
  add column if not exists bot_id         uuid        references public.bots(id) on delete set null,
  add column if not exists title          text        not null default '',
  add column if not exists message        text        not null default '',
  add column if not exists audience       text        not null default 'all',
  add column if not exists audience_count int         not null default 0,
  add column if not exists buttons        jsonb       not null default '[]',
  add column if not exists sent           int         not null default 0,
  add column if not exists delivered      int         not null default 0,
  add column if not exists failed         int         not null default 0,
  add column if not exists scheduled_for  timestamptz,
  add column if not exists started_at     timestamptz,
  add column if not exists finished_at    timestamptz;

-- Add status column with check constraint only if it doesn't exist yet
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'broadcasts' and column_name = 'status'
  ) then
    alter table public.broadcasts
      add column status text not null default 'draft'
        check (status in ('draft','scheduled','sending','done','failed','canceled'));
  end if;
end;
$$;
