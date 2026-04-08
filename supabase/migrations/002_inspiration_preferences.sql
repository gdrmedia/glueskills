create table if not exists inspiration_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  enabled_sources jsonb not null default '["awwwards","codrops","onepagelove","behance","siteinspire"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_inspiration_preferences_user_id on inspiration_preferences(user_id);
alter table inspiration_preferences enable row level security;

create policy "Users manage own inspiration preferences"
  on inspiration_preferences for all
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'))
  with check (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));
