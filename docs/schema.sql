-- Kuroha UGC — схема PostgreSQL для MVP.
-- Черновик, не миграция продакшена. Перед запуском: review, RLS/права,
-- бэкапы и юридическая проверка.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Перечисления
-- ---------------------------------------------------------------------------

create type user_role as enum ('reader', 'translator', 'moderator', 'admin');
create type user_status as enum ('active', 'suspended', 'deleted');
create type auth_token_kind as enum ('email_verify', 'password_reset');

create type team_role as enum ('owner', 'translator', 'editor', 'proofreader');
create type team_status as enum ('active', 'suspended');

create type title_type as enum ('manga', 'manhwa', 'manhua', 'novel');
create type title_status as enum ('draft', 'published', 'hidden');
create type rights_status as enum (
  'licensed',
  'permission',
  'public_domain',
  'cc',
  'unverified'
);

create type chapter_status as enum ('draft', 'review', 'published', 'removed');
create type version_status as enum (
  'draft',
  'review',
  'changes_requested',
  'published',
  'rejected',
  'removed'
);

create type report_target as enum ('title', 'chapter', 'user', 'comment');
create type report_reason as enum (
  'copyright',
  'adult',
  'spam',
  'abuse',
  'quality',
  'other'
);
create type report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create type dmca_status as enum ('new', 'reviewing', 'accepted', 'rejected');

-- ---------------------------------------------------------------------------
-- Пользователи и сессии
-- ---------------------------------------------------------------------------

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  role user_role not null default 'reader',
  status user_status not null default 'active',
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index users_email_lower_uniq on users (lower(email));
create index users_role_idx on users (role);
create index users_status_idx on users (status);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  ip inet,
  user_agent text
);

create index sessions_user_idx on sessions (user_id);
create index sessions_expires_idx on sessions (expires_at);

create table auth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind auth_token_kind not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index auth_tokens_user_kind_idx on auth_tokens (user_id, kind);

-- ---------------------------------------------------------------------------
-- Команды переводчиков
-- ---------------------------------------------------------------------------

create table teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,64}$'),
  name text not null check (char_length(name) between 2 and 120),
  description text,
  avatar_key text,
  owner_id uuid not null references users (id),
  status team_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teams_owner_idx on teams (owner_id);

create table team_members (
  team_id uuid not null references teams (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  role team_role not null default 'translator',
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index team_members_user_idx on team_members (user_id);

create table team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  email text not null,
  role team_role not null default 'translator',
  token_hash text not null unique,
  invited_by uuid not null references users (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index team_invites_team_idx on team_invites (team_id);
create unique index team_invites_pending_uniq
  on team_invites (team_id, lower(email))
  where accepted_at is null;

-- ---------------------------------------------------------------------------
-- Тайтлы
-- ---------------------------------------------------------------------------

create table titles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,120}$'),
  type title_type not null,
  title_ru text not null,
  title_original text,
  description text,
  author_name text,
  artist_name text,
  cover_key text,
  age_rating smallint not null default 0 check (age_rating in (0, 6, 12, 16, 18)),
  status title_status not null default 'draft',
  rights_status rights_status not null default 'unverified',
  rights_holder text,
  license_code text,
  license_url text,
  source_url text,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint titles_published_requires_rights
    check (status <> 'published' or rights_status <> 'unverified')
);

create index titles_status_type_idx on titles (status, type);
create index titles_rights_idx on titles (rights_status);

create table genres (
  id serial primary key,
  slug text not null unique,
  name text not null
);

create table title_genres (
  title_id uuid not null references titles (id) on delete cascade,
  genre_id integer not null references genres (id) on delete cascade,
  primary key (title_id, genre_id)
);

create index title_genres_genre_idx on title_genres (genre_id);

-- ---------------------------------------------------------------------------
-- Главы и версии переводов
-- ---------------------------------------------------------------------------

create table chapters (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references titles (id) on delete cascade,
  number numeric(7, 2) not null check (number >= 0),
  volume integer check (volume is null or volume > 0),
  name text,
  language text not null default 'ru' check (language ~ '^[a-z]{2}(-[a-z]{2})?$'),
  status chapter_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title_id, number, language)
);

create index chapters_title_idx on chapters (title_id);
create index chapters_status_idx on chapters (status);

create table chapter_versions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters (id) on delete cascade,
  team_id uuid not null references teams (id) on delete restrict,
  version integer not null default 1 check (version > 0),
  status version_status not null default 'draft',
  rights_note text,
  source_url text,
  proof_url text,
  submitted_by uuid not null references users (id),
  reviewed_by uuid references users (id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chapter_id, team_id, version),
  constraint versions_published_requires_review
    check (status <> 'published' or reviewed_by is not null)
);

create index chapter_versions_chapter_idx on chapter_versions (chapter_id);
create index chapter_versions_team_idx on chapter_versions (team_id);
create index chapter_versions_status_idx on chapter_versions (status);

create table pages (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references chapter_versions (id) on delete cascade,
  page_number integer not null check (page_number > 0),
  image_key text not null,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  byte_size bigint check (byte_size is null or byte_size > 0),
  checksum text,
  created_at timestamptz not null default now(),
  unique (version_id, page_number)
);

create index pages_version_idx on pages (version_id);

-- ---------------------------------------------------------------------------
-- Чтение
-- ---------------------------------------------------------------------------

create table reading_progress (
  user_id uuid not null references users (id) on delete cascade,
  title_id uuid not null references titles (id) on delete cascade,
  chapter_id uuid references chapters (id) on delete set null,
  page integer not null default 1 check (page > 0),
  percent numeric(5, 2) not null default 0 check (percent between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

create index reading_progress_title_idx on reading_progress (title_id);

create table bookmarks (
  user_id uuid not null references users (id) on delete cascade,
  title_id uuid not null references titles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

create index bookmarks_title_idx on bookmarks (title_id);

-- ---------------------------------------------------------------------------
-- Жалобы и обращения правообладателей
-- ---------------------------------------------------------------------------

create table reports (
  id uuid primary key default gen_random_uuid(),
  ticket_code text not null unique,
  reporter_id uuid references users (id) on delete set null,
  target_type report_target not null,
  target_id uuid not null,
  reason report_reason not null,
  message text,
  status report_status not null default 'open',
  resolution text,
  resolved_by uuid references users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reports_status_idx on reports (status, created_at);
create index reports_target_idx on reports (target_type, target_id);

create table dmca_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_code text not null unique,
  requester_name text not null,
  email text not null,
  organization text,
  target_urls text[] not null check (cardinality(target_urls) > 0),
  work_description text not null,
  proof_url text,
  good_faith boolean not null default false,
  status dmca_status not null default 'new',
  notes text,
  resolved_by uuid references users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dmca_requests_status_idx on dmca_requests (status, created_at);

-- ---------------------------------------------------------------------------
-- Аудит
-- ---------------------------------------------------------------------------

create table audit_log (
  id bigserial primary key,
  actor_id uuid references users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  meta jsonb not null default '{}'::jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log (entity_type, entity_id);
create index audit_log_actor_idx on audit_log (actor_id, created_at);
create index audit_log_created_idx on audit_log (created_at);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on users
  for each row execute function set_updated_at();

create trigger teams_updated_at
  before update on teams
  for each row execute function set_updated_at();

create trigger titles_updated_at
  before update on titles
  for each row execute function set_updated_at();

create trigger chapters_updated_at
  before update on chapters
  for each row execute function set_updated_at();

create trigger chapter_versions_updated_at
  before update on chapter_versions
  for each row execute function set_updated_at();

create trigger reports_updated_at
  before update on reports
  for each row execute function set_updated_at();

create trigger dmca_requests_updated_at
  before update on dmca_requests
  for each row execute function set_updated_at();

commit;
