-- Banner Spec Sheet Reviewer: persistent shareable viewer rows.
-- See: docs/superpowers/specs/2026-04-21-banner-spec-sheet-reviewer-design.md

create table if not exists spec_sheets (
  code        text primary key,
  user_id     text not null,
  campaign    text not null,
  client      text,
  placements  jsonb not null,
  partners    jsonb not null,
  summary     jsonb not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists idx_spec_sheets_user_id on spec_sheets(user_id);
create index if not exists idx_spec_sheets_deleted_at on spec_sheets(deleted_at);

alter table spec_sheets enable row level security;

-- Web side: authenticated Clerk users manage only their own rows.
create policy "Users insert their own spec sheets"
  on spec_sheets for insert
  with check (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

create policy "Users select their own spec sheets"
  on spec_sheets for select
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

create policy "Users update their own spec sheets"
  on spec_sheets for update
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

create policy "Users delete their own spec sheets"
  on spec_sheets for delete
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

-- Public fetch: anon role calls this RPC (security definer bypasses RLS).
-- Returns null if the row doesn't exist or was soft-deleted. The 6-char code
-- is the bearer token — prevents enumeration of other rows.
create or replace function get_spec_sheet(sheet_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data spec_sheets;
begin
  select * into row_data
  from spec_sheets
  where code = sheet_code
    and deleted_at is null;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'code', row_data.code,
    'campaign', row_data.campaign,
    'client', row_data.client,
    'placements', row_data.placements,
    'partners', row_data.partners,
    'summary', row_data.summary,
    'createdAt', row_data.created_at
  );
end;
$$;

revoke all on function get_spec_sheet(text) from public;
grant execute on function get_spec_sheet(text) to anon;
grant execute on function get_spec_sheet(text) to authenticated;
