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

-- Broadcasts table (if not already created)
create table if not exists public.broadcasts (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  bot_id         uuid        references public.bots(id) on delete set null,
  title          text        not null default '',
  message        text        not null default '',
  audience       text        not null default 'all',
  audience_count int         not null default 0,
  buttons        jsonb       not null default '[]',
  status         text        not null default 'draft'
    check (status in ('draft','scheduled','sending','done','failed','canceled')),
  sent           int         not null default 0,
  delivered      int         not null default 0,
  failed         int         not null default 0,
  scheduled_for  timestamptz,
  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.broadcasts enable row level security;

create policy "broadcasts_owner" on public.broadcasts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists broadcasts_user_id_idx on public.broadcasts (user_id);
