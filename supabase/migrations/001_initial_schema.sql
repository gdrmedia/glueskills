-- GlueSkills Database Schema
-- Run this in your Supabase SQL editor

-- ============================================
-- BRIEFS
-- ============================================
create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  objective text,
  audience text,
  deliverables text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_briefs_user_id on briefs(user_id);

alter table briefs enable row level security;

create policy "Users manage own briefs"
  on briefs for all
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'))
  with check (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

-- ============================================
-- COPY ITEMS
-- ============================================
create table if not exists copy_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  brief_id uuid references briefs(id) on delete set null,
  title text not null,
  content text,
  type text not null default 'headline',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_copy_items_user_id on copy_items(user_id);

alter table copy_items enable row level security;

create policy "Users manage own copy items"
  on copy_items for all
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'))
  with check (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

-- ============================================
-- ASSETS
-- ============================================
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  brief_id uuid references briefs(id) on delete set null,
  name text not null,
  url text,
  type text,
  dimensions text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index idx_assets_user_id on assets(user_id);

alter table assets enable row level security;

create policy "Users manage own assets"
  on assets for all
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'))
  with check (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

-- ============================================
-- CALENDAR EVENTS
-- ============================================
create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  description text,
  date date not null,
  status text not null default 'planned',
  created_at timestamptz not null default now()
);

create index idx_calendar_events_user_id on calendar_events(user_id);

alter table calendar_events enable row level security;

create policy "Users manage own calendar events"
  on calendar_events for all
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'))
  with check (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

-- ============================================
-- NOTES
-- ============================================
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_notes_user_id on notes(user_id);

alter table notes enable row level security;

create policy "Users manage own notes"
  on notes for all
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'))
  with check (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));
