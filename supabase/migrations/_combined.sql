-- ============================================================
-- Umbra Bot â€” Setup inicial
-- ExtensÃ£o pgcrypto + funÃ§Ã£o set_updated_at compartilhada
-- ============================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Umbra Bot â€” Tabela: contacts
-- Rota: /dashboard/customers
-- ============================================================

create table if not exists public.contacts (
  id              uuid primary key default gen_random_uuid(),
  name            text          not null,
  telegram_id     text,
  phone           text,
  email           text,
  bot             text,
  status          text          not null default 'new'
                    check (status in ('new', 'active', 'vip', 'inactive', 'blocked')),
  tags            text[]        not null default '{}',
  total_spent     numeric(12,2) not null default 0,
  orders_count    integer       not null default 0,
  city            text,
  state           text,
  first_contact   timestamptz   not null default now(),
  last_contact    timestamptz   not null default now(),
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create index if not exists contacts_status_idx       on public.contacts (status);
create index if not exists contacts_last_contact_idx on public.contacts (last_contact desc);
create index if not exists contacts_tags_idx         on public.contacts using gin (tags);
create index if not exists contacts_telegram_id_idx  on public.contacts (telegram_id);

create or replace trigger contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

alter table public.contacts enable row level security;
drop policy if exists "contacts_open" on public.contacts;
create policy "contacts_open" on public.contacts for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: activity_events
-- Rota: /dashboard/activity
-- ============================================================

create table if not exists public.activity_events (
  id          uuid primary key default gen_random_uuid(),
  type        text not null
                check (type in (
                  'sale', 'new_lead', 'checkout', 'bot_online', 'bot_offline',
                  'refund', 'webhook', 'flow', 'block', 'affiliate_join',
                  'broadcast', 'payment_fail'
                )),
  title       text          not null,
  description text          not null default '',
  bot         text          not null default '',
  amount      numeric(12,2),
  created_at  timestamptz   not null default now()
);

create index if not exists activity_events_created_at_idx on public.activity_events (created_at desc);
create index if not exists activity_events_type_idx       on public.activity_events (type);
create index if not exists activity_events_bot_idx        on public.activity_events (bot);

alter table public.activity_events enable row level security;
drop policy if exists "activity_events_open" on public.activity_events;
create policy "activity_events_open" on public.activity_events for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: affiliates
-- Rota: /dashboard/affiliates
-- ============================================================

create table if not exists public.affiliates (
  id              uuid          primary key default gen_random_uuid(),
  name            text          not null,
  email           text          not null,
  slug            text          not null unique,
  status          text          not null default 'active'
                    check (status in ('active', 'paused', 'archived')),
  clicks          integer       not null default 0,
  sales           integer       not null default 0,
  commission      numeric(12,2) not null default 0,
  conversion_rate numeric(5,2)  not null default 0,
  payment_method  text,
  joined_at       timestamptz   not null default now(),
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create index if not exists affiliates_status_idx     on public.affiliates (status);
create index if not exists affiliates_commission_idx on public.affiliates (commission desc);
create index if not exists affiliates_slug_idx       on public.affiliates (slug);

create or replace trigger affiliates_updated_at
  before update on public.affiliates
  for each row execute function public.set_updated_at();

alter table public.affiliates enable row level security;
drop policy if exists "affiliates_open" on public.affiliates;
create policy "affiliates_open" on public.affiliates for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: affiliate_payments
-- Rota: /dashboard/affiliates â†’ Pagamentos
-- Depende de: affiliates
-- ============================================================

create table if not exists public.affiliate_payments (
  id              uuid          primary key default gen_random_uuid(),
  affiliate_id    uuid          not null references public.affiliates (id) on delete cascade,
  cycle           text          not null,
  sales           integer       not null default 0,
  amount          numeric(12,2) not null default 0,
  status          text          not null default 'pending'
                    check (status in ('pending', 'paid')),
  paid_at         date,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create index if not exists aff_payments_affiliate_idx on public.affiliate_payments (affiliate_id);
create index if not exists aff_payments_status_idx    on public.affiliate_payments (status);
create index if not exists aff_payments_cycle_idx     on public.affiliate_payments (cycle);

create or replace trigger affiliate_payments_updated_at
  before update on public.affiliate_payments
  for each row execute function public.set_updated_at();

alter table public.affiliate_payments enable row level security;
drop policy if exists "affiliate_payments_open" on public.affiliate_payments;
create policy "affiliate_payments_open" on public.affiliate_payments for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: alerts
-- Rota: /dashboard/alerts
-- ============================================================

create table if not exists public.alerts (
  id          uuid primary key default gen_random_uuid(),
  type        text not null
                check (type in (
                  'gateway_fail', 'bot_banned', 'bot_offline', 'send_quota',
                  'webhook_fail', 'payment_pending', 'limit_warning', 'ssl_expiring'
                )),
  severity    text          not null default 'warning'
                check (severity in ('critical', 'warning', 'info')),
  title       text          not null,
  description text          not null default '',
  context     jsonb         not null default '[]',
  resolved    boolean       not null default false,
  resolved_at timestamptz,
  resolved_by text,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create index if not exists alerts_resolved_idx   on public.alerts (resolved);
create index if not exists alerts_severity_idx   on public.alerts (severity);
create index if not exists alerts_created_at_idx on public.alerts (created_at desc);

create or replace trigger alerts_updated_at
  before update on public.alerts
  for each row execute function public.set_updated_at();

alter table public.alerts enable row level security;
drop policy if exists "alerts_open" on public.alerts;
create policy "alerts_open" on public.alerts for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: bots
-- Rota: /dashboard/bots
-- ============================================================

create table if not exists public.bots (
  id               uuid          primary key default gen_random_uuid(),
  name             text          not null,
  username         text          not null,
  status           text          not null default 'offline'
                     check (status in ('online', 'offline', 'banned', 'paused')),
  leads            integer       not null default 0,
  sales            integer       not null default 0,
  conversion       numeric(5,2)  not null default 0,
  revenue          numeric(12,2) not null default 0,
  active_flow_id   uuid,
  color            text          not null default '#6366f1',
  telegram_id      text,
  token            text,
  welcome_message  text          not null default '',
  fallback_message text          not null default '',
  description      text          not null default '',
  webhook_url      text          not null default '',
  last_sync        timestamptz,
  added_at         timestamptz   not null default now(),
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

create index if not exists bots_status_idx   on public.bots (status);
create index if not exists bots_username_idx on public.bots (username);
create index if not exists bots_revenue_idx  on public.bots (revenue desc);

create or replace trigger bots_updated_at
  before update on public.bots
  for each row execute function public.set_updated_at();

alter table public.bots enable row level security;
drop policy if exists "bots_open" on public.bots;
create policy "bots_open" on public.bots for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: flows
-- Rota: /dashboard/flows
-- ============================================================

create table if not exists public.flows (
  id          uuid          primary key default gen_random_uuid(),
  name        text          not null,
  bot         text          not null default '',
  bot_color   text          not null default '#6366f1',
  status      text          not null default 'draft'
                check (status in ('published', 'draft')),
  executions  integer       not null default 0,
  conversion  numeric(5,2)  not null default 0,
  description text          not null default '',
  nodes       jsonb         not null default '[]',
  edges       jsonb         not null default '[]',
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create index if not exists flows_status_idx     on public.flows (status);
create index if not exists flows_bot_idx        on public.flows (bot);
create index if not exists flows_updated_at_idx on public.flows (updated_at desc);

create or replace trigger flows_updated_at
  before update on public.flows
  for each row execute function public.set_updated_at();

alter table public.flows enable row level security;
drop policy if exists "flows_open" on public.flows;
create policy "flows_open" on public.flows for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: redirects
-- Rota: /dashboard/redirects
-- ============================================================

create table if not exists public.redirects (
  id                uuid          primary key default gen_random_uuid(),
  slug              text          not null unique,
  url               text          not null,
  destination       text          not null,
  destination_label text          not null default '',
  clicks            integer       not null default 0,
  unique_clicks     integer       not null default 0,
  status            text          not null default 'active'
                      check (status in ('active', 'paused', 'archived')),
  cloaking          boolean       not null default false,
  decoy_url         text,
  utm               jsonb         not null default '{}',
  redirect_type     text          not null default '302'
                      check (redirect_type in ('301', '302', 'js', 'meta')),
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create index if not exists redirects_status_idx     on public.redirects (status);
create index if not exists redirects_slug_idx       on public.redirects (slug);
create index if not exists redirects_clicks_idx     on public.redirects (clicks desc);
create index if not exists redirects_created_at_idx on public.redirects (created_at desc);

create or replace trigger redirects_updated_at
  before update on public.redirects
  for each row execute function public.set_updated_at();

alter table public.redirects enable row level security;
drop policy if exists "redirects_open" on public.redirects;
create policy "redirects_open" on public.redirects for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: remarketing_campaigns
-- Rota: /dashboard/remarketing
-- ============================================================

create table if not exists public.remarketing_campaigns (
  id                uuid          primary key default gen_random_uuid(),
  name              text          not null,
  description       text          not null default '',
  trigger_type      text          not null default 'carrinho_abandonado',
  audience          text          not null default 'all',
  trigger_config    jsonb         not null default '{}',
  status            text          not null default 'draft'
                      check (status in ('active', 'paused', 'draft', 'finished')),
  leads_recovered   integer       not null default 0,
  revenue_recovered numeric(12,2) not null default 0,
  leads_triggered   integer       not null default 0,
  conversion        numeric(5,2)  not null default 0,
  steps             jsonb         not null default '[]',
  step_stats        jsonb         not null default '[]',
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create index if not exists remarketing_status_idx     on public.remarketing_campaigns (status);
create index if not exists remarketing_trigger_idx    on public.remarketing_campaigns (trigger_type);
create index if not exists remarketing_updated_at_idx on public.remarketing_campaigns (updated_at desc);

create or replace trigger remarketing_campaigns_updated_at
  before update on public.remarketing_campaigns
  for each row execute function public.set_updated_at();

alter table public.remarketing_campaigns enable row level security;
drop policy if exists "remarketing_campaigns_open" on public.remarketing_campaigns;
create policy "remarketing_campaigns_open" on public.remarketing_campaigns for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: broadcasts
-- Rota: /dashboard/broadcasts
-- ============================================================

create table if not exists public.broadcasts (
  id             uuid          primary key default gen_random_uuid(),
  title          text          not null default 'Novo disparo',
  bot            text          not null default '',
  audience       text          not null default 'leads',
  audience_count integer       not null default 0,
  status         text          not null default 'draft'
                   check (status in ('draft', 'scheduled', 'sending', 'done', 'failed', 'canceled')),
  sent           integer       not null default 0,
  delivered      integer       not null default 0,
  failed         integer       not null default 0,
  scheduled_for  bigint,
  started_at     bigint,
  finished_at    bigint,
  failure_reason text,
  message        text          not null default '',
  media          jsonb,
  buttons        jsonb         not null default '[]',
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now()
);

create index if not exists broadcasts_status_idx     on public.broadcasts (status);
create index if not exists broadcasts_bot_idx        on public.broadcasts (bot);
create index if not exists broadcasts_created_at_idx on public.broadcasts (created_at desc);

create or replace trigger broadcasts_updated_at
  before update on public.broadcasts
  for each row execute function public.set_updated_at();

alter table public.broadcasts enable row level security;
drop policy if exists "broadcasts_open" on public.broadcasts;
create policy "broadcasts_open" on public.broadcasts for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: gateways
-- Rota: /dashboard/gateways
-- ============================================================

create table if not exists public.gateways (
  id               text          primary key,
  name             text          not null,
  connected        boolean       not null default false,
  account          text,
  api_key          text,
  processed_volume numeric(14,2) not null default 0,
  processed_tx     integer       not null default 0,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

create index if not exists gateways_connected_idx on public.gateways (connected);

create or replace trigger gateways_updated_at
  before update on public.gateways
  for each row execute function public.set_updated_at();

alter table public.gateways enable row level security;
drop policy if exists "gateways_open" on public.gateways;
create policy "gateways_open" on public.gateways for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: pixels
-- Rota: /dashboard/tracking
-- ============================================================

create table if not exists public.pixels (
  id                 text          primary key,
  name               text          not null,
  full_name          text          not null default '',
  description        text          not null default '',
  initial            text          not null default '',
  color              text          not null default '',
  pixel_id           text,
  access_token       text,
  status             text          not null default 'inactive'
                       check (status in ('healthy', 'warning', 'error', 'inactive')),
  events_sent_today  integer       not null default 0,
  events_matched     integer       not null default 0,
  last_event         bigint,
  events             jsonb         not null default '{}',
  capi               boolean       not null default false,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now()
);

create index if not exists pixels_status_idx on public.pixels (status);

create or replace trigger pixels_updated_at
  before update on public.pixels
  for each row execute function public.set_updated_at();

alter table public.pixels enable row level security;
drop policy if exists "pixels_open" on public.pixels;
create policy "pixels_open" on public.pixels for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: checkouts
-- Rota: /dashboard/checkout
-- ============================================================

create table if not exists public.checkouts (
  id            text          primary key,
  name          text          not null,
  slug          text          not null unique,
  product_name  text          not null default '',
  product_desc  text          not null default '',
  price         numeric(12,2) not null default 0,
  installments  integer       not null default 1,
  gateway       text          not null default 'pushinpay',
  pixel         text          not null default 'none',
  primary_color text          not null default '#7c3aed',
  bg_variant    text          not null default 'light'
                  check (bg_variant in ('light', 'dark')),
  font          text          not null default 'Inter',
  logo          text          not null default '',
  badge         text,
  fields        jsonb         not null default '{"name":true,"email":true,"cpf":false,"phone":false,"address":false,"cep":false}',
  methods       jsonb         not null default '{"pix":true,"card":true,"boleto":false}',
  layout        text          not null default 'two_col'
                  check (layout in ('two_col', 'one_col')),
  status        text          not null default 'draft'
                  check (status in ('published', 'draft', 'archived')),
  visits        integer       not null default 0,
  conversions   integer       not null default 0,
  conversion    numeric(5,2)  not null default 0,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

create index if not exists checkouts_status_idx     on public.checkouts (status);
create index if not exists checkouts_slug_idx       on public.checkouts (slug);
create index if not exists checkouts_updated_at_idx on public.checkouts (updated_at desc);

create or replace trigger checkouts_updated_at
  before update on public.checkouts
  for each row execute function public.set_updated_at();

alter table public.checkouts enable row level security;
drop policy if exists "checkouts_open" on public.checkouts;
create policy "checkouts_open" on public.checkouts for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: biolinks
-- Rota: /dashboard/biolink
-- ============================================================

create table if not exists public.biolinks (
  id            text        primary key,
  slug          text        not null unique,
  name          text        not null default '',
  bio           text        not null default '',
  avatar        text        not null default '',
  avatar_color  text        not null default '#7c3aed',
  theme_id      text        not null default 'violet',
  background    text        not null default 'solid'
                  check (background in ('solid', 'gradient', 'dots')),
  button_style  text        not null default 'rounded'
                  check (button_style in ('rounded', 'sharp', 'pill')),
  links         jsonb       not null default '[]',
  views         integer     not null default 0,
  clicks        integer     not null default 0,
  conversion    numeric(5,2) not null default 0,
  top_referrer  text        not null default '',
  status        text        not null default 'draft'
                  check (status in ('published', 'draft')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists biolinks_slug_idx       on public.biolinks (slug);
create index if not exists biolinks_status_idx     on public.biolinks (status);
create index if not exists biolinks_updated_at_idx on public.biolinks (updated_at desc);

create or replace trigger biolinks_updated_at
  before update on public.biolinks
  for each row execute function public.set_updated_at();

alter table public.biolinks enable row level security;
drop policy if exists "biolinks_open" on public.biolinks;
create policy "biolinks_open" on public.biolinks for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: webhooks
-- Rota: /dashboard/webhooks
-- ============================================================

create table if not exists public.webhooks (
  id              text        primary key,
  name            text        not null,
  url             text        not null,
  events          text[]      not null default '{}',
  secret          text        not null default '',
  status          text        not null default 'healthy'
                    check (status in ('healthy', 'failing', 'paused')),
  active          boolean     not null default true,
  deliveries_24h  integer     not null default 0,
  success_rate    numeric(5,2) not null default 100,
  last_delivery   bigint,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists webhooks_status_idx     on public.webhooks (status);
create index if not exists webhooks_active_idx     on public.webhooks (active);
create index if not exists webhooks_updated_at_idx on public.webhooks (updated_at desc);

create or replace trigger webhooks_updated_at
  before update on public.webhooks
  for each row execute function public.set_updated_at();

alter table public.webhooks enable row level security;
drop policy if exists "webhooks_open" on public.webhooks;
create policy "webhooks_open" on public.webhooks for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: profiles
-- Rota: /dashboard/profile
-- ============================================================

create table if not exists public.profiles (
  id            text        primary key default gen_random_uuid()::text,
  name          text        not null default '',
  email         text        not null default '',
  phone         text        not null default '',
  avatar        text        not null default '',
  avatar_color  text        not null default '#7c3aed',
  timezone      text        not null default 'America/Sao_Paulo (GMT-03)',
  language      text        not null default 'PortuguÃªs (Brasil)',
  workspace     text        not null default '',
  two_fa_enabled   boolean  not null default false,
  two_fa_enabled_at bigint,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_email_idx      on public.profiles (email);
create index if not exists profiles_updated_at_idx on public.profiles (updated_at desc);

create or replace trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
drop policy if exists "profiles_open" on public.profiles;
create policy "profiles_open" on public.profiles for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: team_members
-- Rota: /dashboard/profile (seÃ§Ã£o Equipe)
-- ============================================================

create table if not exists public.team_members (
  id          text        primary key default gen_random_uuid()::text,
  name        text        not null default '',
  email       text        not null unique,
  avatar      text        not null default '',
  color       text        not null default '#7c3aed',
  role        text        not null default 'editor'
                check (role in ('owner', 'admin', 'editor', 'analyst')),
  status      text        not null default 'invited'
                check (status in ('active', 'invited')),
  last_seen   bigint,
  joined_at   bigint      not null default extract(epoch from now())::bigint * 1000,
  self        boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists team_members_role_idx       on public.team_members (role);
create index if not exists team_members_status_idx     on public.team_members (status);
create index if not exists team_members_updated_at_idx on public.team_members (updated_at desc);

create or replace trigger team_members_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();

alter table public.team_members enable row level security;
drop policy if exists "team_members_open" on public.team_members;
create policy "team_members_open" on public.team_members for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: notification_prefs
-- Rota: /dashboard/notifications
-- ============================================================

create table if not exists public.notification_prefs (
  id            text        primary key default gen_random_uuid()::text,
  prefs         jsonb       not null default '{}',
  channel_state jsonb       not null default '{"email":{"linked":true},"panel":{"linked":true},"telegram":{"linked":false}}',
  quiet         jsonb       not null default '{"enabled":true,"from":"22:00","to":"07:00","exceptCritical":true}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists notification_prefs_updated_at_idx on public.notification_prefs (updated_at desc);

create or replace trigger notification_prefs_updated_at
  before update on public.notification_prefs
  for each row execute function public.set_updated_at();

alter table public.notification_prefs enable row level security;
drop policy if exists "notification_prefs_open" on public.notification_prefs;
create policy "notification_prefs_open" on public.notification_prefs for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: guide_articles
-- Rota: /dashboard/guide
-- ============================================================

create table if not exists public.guide_articles (
  id          text        primary key default gen_random_uuid()::text,
  title       text        not null default '',
  excerpt     text        not null default '',
  category    text        not null default '',
  read_min    integer     not null default 5,
  views       integer     not null default 0,
  featured    boolean     not null default false,
  body        text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists guide_articles_category_idx    on public.guide_articles (category);
create index if not exists guide_articles_featured_idx    on public.guide_articles (featured);
create index if not exists guide_articles_updated_at_idx  on public.guide_articles (updated_at desc);

create or replace trigger guide_articles_updated_at
  before update on public.guide_articles
  for each row execute function public.set_updated_at();

alter table public.guide_articles enable row level security;
drop policy if exists "guide_articles_open" on public.guide_articles;
create policy "guide_articles_open" on public.guide_articles for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Tabela: courses
-- Rota: /dashboard/academy
-- ============================================================

create table if not exists public.courses (
  id                text        primary key default gen_random_uuid()::text,
  title             text        not null default '',
  subtitle          text        not null default '',
  instructor        text        not null default '',
  instructor_role   text        not null default '',
  instructor_avatar text        not null default '',
  level             text        not null default 'Iniciante',
  duration_min      integer     not null default 60,
  cover_accent      text        not null default 'var(--primary)',
  cover_pattern     text        not null default 'wave'
                      check (cover_pattern in ('wave','grid','rays','dots','mesh')),
  featured          boolean     not null default false,
  enrolled_at       bigint,
  modules           jsonb       not null default '[]',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists courses_featured_idx    on public.courses (featured);
create index if not exists courses_updated_at_idx  on public.courses (updated_at desc);

create or replace trigger courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

alter table public.courses enable row level security;
drop policy if exists "courses_open" on public.courses;
create policy "courses_open" on public.courses for all using (true) with check (true);

-- ============================================================
-- Umbra Bot â€” Multi-tenancy: adiciona user_id + RLS real
-- Substitui as polÃ­ticas abertas (using true) por filtragem
-- por auth.uid() em todas as tabelas de dados.
-- ============================================================

-- â”€â”€ bots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.bots
  add column if not exists user_id         uuid references auth.users(id) on delete cascade,
  add column if not exists webhook_secret  text unique default gen_random_uuid()::text;

create index if not exists bots_user_id_idx on public.bots (user_id);

drop policy if exists "bots_open"  on public.bots;
create policy "bots_owner" on public.bots
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ contacts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.contacts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists contacts_user_id_idx on public.contacts (user_id);

drop policy if exists "contacts_open" on public.contacts;
create policy "contacts_owner" on public.contacts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ activity_events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.activity_events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists activity_events_user_id_idx on public.activity_events (user_id);

drop policy if exists "activity_events_open" on public.activity_events;
create policy "activity_events_owner" on public.activity_events
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ affiliates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.affiliates
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists affiliates_user_id_idx on public.affiliates (user_id);

drop policy if exists "affiliates_open" on public.affiliates;
create policy "affiliates_owner" on public.affiliates
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ affiliate_payments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.affiliate_payments
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop policy if exists "affiliate_payments_open" on public.affiliate_payments;
create policy "affiliate_payments_owner" on public.affiliate_payments
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ alerts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.alerts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists alerts_user_id_idx on public.alerts (user_id);

drop policy if exists "alerts_open" on public.alerts;
create policy "alerts_owner" on public.alerts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ flows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.flows
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists flows_user_id_idx on public.flows (user_id);

drop policy if exists "flows_open" on public.flows;
create policy "flows_owner" on public.flows
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ redirects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.redirects
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists redirects_user_id_idx on public.redirects (user_id);

drop policy if exists "redirects_open" on public.redirects;
create policy "redirects_owner" on public.redirects
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ remarketing_campaigns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.remarketing_campaigns
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists remarketing_campaigns_user_id_idx on public.remarketing_campaigns (user_id);

drop policy if exists "remarketing_campaigns_open" on public.remarketing_campaigns;
create policy "remarketing_campaigns_owner" on public.remarketing_campaigns
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ broadcasts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.broadcasts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists broadcasts_user_id_idx on public.broadcasts (user_id);

drop policy if exists "broadcasts_open" on public.broadcasts;
create policy "broadcasts_owner" on public.broadcasts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ gateways â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.gateways
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists gateways_user_id_idx on public.gateways (user_id);

drop policy if exists "gateways_open" on public.gateways;
create policy "gateways_owner" on public.gateways
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ pixels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.pixels
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists pixels_user_id_idx on public.pixels (user_id);

drop policy if exists "pixels_open" on public.pixels;
create policy "pixels_owner" on public.pixels
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ checkouts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.checkouts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists checkouts_user_id_idx on public.checkouts (user_id);

drop policy if exists "checkouts_open" on public.checkouts;
create policy "checkouts_owner" on public.checkouts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ biolinks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.biolinks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists biolinks_user_id_idx on public.biolinks (user_id);

drop policy if exists "biolinks_open" on public.biolinks;
create policy "biolinks_owner" on public.biolinks
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ webhooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.webhooks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists webhooks_user_id_idx on public.webhooks (user_id);

drop policy if exists "webhooks_open" on public.webhooks;
create policy "webhooks_owner" on public.webhooks
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ notification_prefs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.notification_prefs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop policy if exists "notification_prefs_open" on public.notification_prefs;
create policy "notification_prefs_owner" on public.notification_prefs
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- â”€â”€ transactions (nova tabela) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table if not exists public.transactions (
  id                 uuid          primary key default gen_random_uuid(),
  user_id            uuid          not null references auth.users(id) on delete cascade,
  bot_id             uuid          references public.bots(id) on delete set null,
  contact_id         uuid          references public.contacts(id) on delete set null,
  gateway            text          not null default '',
  gateway_payment_id text,
  amount             numeric(12,2) not null,
  fee                numeric(12,2) not null default 0,
  net                numeric(12,2) generated always as (amount - fee) stored,
  status             text          not null default 'pending'
                       check (status in ('pending','approved','refunded','cancelled','expired')),
  pix_qr_code        text,
  pix_copy_paste     text,
  pix_expires_at     timestamptz,
  product_name       text          not null default '',
  customer_name      text,
  customer_email     text,
  customer_telegram_id text,
  metadata           jsonb         not null default '{}',
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now()
);

create index if not exists transactions_user_id_idx    on public.transactions (user_id);
create index if not exists transactions_status_idx     on public.transactions (status);
create index if not exists transactions_created_at_idx on public.transactions (created_at desc);
create index if not exists transactions_gateway_pid_idx on public.transactions (gateway_payment_id);

create or replace trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;
create policy "transactions_owner" on public.transactions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Umbra Bot â€” Profiles vinculados ao auth.users
-- Recria a tabela profiles com UUID como PK (= auth user id)
-- e adiciona trigger para criaÃ§Ã£o automÃ¡tica no signup.
-- ============================================================

-- Recriar profiles com id = auth.users.id
drop table if exists public.profiles cascade;

create table public.profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  name          text        not null default '',
  email         text        not null default '',
  phone         text        not null default '',
  avatar_url    text        not null default '',
  avatar_color  text        not null default '#7c3aed',
  timezone      text        not null default 'America/Sao_Paulo (GMT-03)',
  language      text        not null default 'PortuguÃªs (Brasil)',
  workspace     text        not null default '',
  two_fa_enabled   boolean  not null default false,
  two_fa_enabled_at bigint,
  plan          text        not null default 'free' check (plan in ('free','pro','enterprise')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);

create or replace trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Cada usuÃ¡rio sÃ³ vÃª e edita o prÃ³prio perfil
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Trigger: cria perfil automaticamente quando um novo usuÃ¡rio se registra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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

-- ============================================================
-- Umbra Bot â€” Tabela: transactions
-- Rota: /api/payments/pix, /dashboard/finance
-- ============================================================

create table if not exists public.transactions (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users(id) on delete cascade,
  bot_id                uuid,
  gateway               text        not null default 'mercadopago',
  gateway_payment_id    text,
  amount                numeric(12,2) not null,
  net                   numeric(12,2),
  fee                   numeric(12,2) not null default 0,
  status                text        not null default 'pending'
                          check (status in ('pending','approved','cancelled','refunded')),
  pix_qr_code           text,
  pix_copy_paste        text,
  pix_expires_at        timestamptz,
  product_name          text        not null default '',
  customer_name         text        not null default '',
  customer_email        text        not null default '',
  customer_cpf          text,
  customer_telegram_id  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists transactions_user_id_idx    on public.transactions (user_id);
create index if not exists transactions_status_idx     on public.transactions (status);
create index if not exists transactions_created_at_idx on public.transactions (created_at desc);
create index if not exists transactions_gateway_id_idx on public.transactions (gateway_payment_id);

create or replace trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

create policy "transactions_owner" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

