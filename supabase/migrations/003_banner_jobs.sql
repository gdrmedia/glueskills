-- Banner Resizer: job storage table + plugin-consumption RPC
-- See: docs/superpowers/specs/2026-04-15-banner-resizer-design.md

create table if not exists banner_jobs (
  code           text primary key,
  user_id        text not null,
  name           text not null,
  config         jsonb not null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '24 hours'),
  consumed_at    timestamptz
);

create index if not exists idx_banner_jobs_user_id on banner_jobs(user_id);
create index if not exists idx_banner_jobs_expires_at on banner_jobs(expires_at);

alter table banner_jobs enable row level security;

-- Web side: authenticated Clerk users can manage their own rows
create policy "Users insert their own banner jobs"
  on banner_jobs for insert
  with check (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

create policy "Users select their own banner jobs"
  on banner_jobs for select
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

create policy "Users update their own banner jobs"
  on banner_jobs for update
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

create policy "Users delete their own banner jobs"
  on banner_jobs for delete
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

-- Plugin side: anon role calls this RPC, which is security-definer so it bypasses RLS.
-- The 6-char code is the bearer token.
create or replace function consume_banner_job(job_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  job_row banner_jobs;
  upper_code text;
begin
  upper_code := upper(job_code);

  select * into job_row from banner_jobs where code = upper_code;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if job_row.expires_at < now() then
    return jsonb_build_object('error', 'expired');
  end if;

  -- Idempotency: re-fetch within 5 min of first consumption is OK; after that, locked.
  if job_row.consumed_at is not null and job_row.consumed_at < now() - interval '5 minutes' then
    return jsonb_build_object('error', 'already_used');
  end if;

  update banner_jobs
    set consumed_at = coalesce(consumed_at, now())  -- preserve original timestamp
    where code = upper_code;

  return jsonb_build_object(
    'name', job_row.name,
    'config', job_row.config
  );
end;
$$;

revoke all on function consume_banner_job(text) from public;
grant execute on function consume_banner_job(text) to anon;
grant execute on function consume_banner_job(text) to authenticated;

-- Cleanup RPC for the hourly Vercel cron. Bypasses RLS so it can delete any
-- expired or stale-consumed row, regardless of which user owns it.
create or replace function cleanup_banner_jobs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count int;
  consumed_count int;
begin
  with del as (
    delete from banner_jobs where expires_at < now() returning 1
  )
  select count(*) into expired_count from del;

  with del as (
    delete from banner_jobs where consumed_at < now() - interval '7 days' returning 1
  )
  select count(*) into consumed_count from del;

  return jsonb_build_object(
    'deletedExpired', expired_count,
    'deletedConsumed', consumed_count
  );
end;
$$;

revoke all on function cleanup_banner_jobs() from public;
grant execute on function cleanup_banner_jobs() to anon;
grant execute on function cleanup_banner_jobs() to authenticated;
