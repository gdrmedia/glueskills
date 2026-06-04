-- Creative Kickoff Brief: one row per brief, JSONB sections.
-- See: docs/superpowers/specs/2026-06-02-creative-kickoff-brief-tool-design.md

create table if not exists project_kickoffs (
  id            uuid primary key default gen_random_uuid(),
  title         text not null default 'Untitled brief',
  status        text not null default 'draft',  -- draft | under_review | approved
  locked        boolean not null default false,
  deliverables  jsonb not null default '{"case_study":false,"social":false,"award":false}'::jsonb,
  sections      jsonb not null default '{}'::jsonb,
  created_by    text not null,
  submitted_by  text,
  submitted_at  timestamptz,
  approved_by   text,
  approved_at   timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_project_kickoffs_status     on project_kickoffs(status);
create index if not exists idx_project_kickoffs_deleted_at on project_kickoffs(deleted_at);

-- set_updated_at() already exists (migration 005_brands.sql).
drop trigger if exists project_kickoffs_set_updated_at on project_kickoffs;
create trigger project_kickoffs_set_updated_at
  before update on project_kickoffs
  for each row execute function set_updated_at();

alter table project_kickoffs enable row level security;

-- Internal-team posture (same as brands): any authenticated Clerk user has full access.
-- Finer rules (who can approve, lock gating, draft-only delete) live in the app core.
create policy "Authenticated read kickoffs"   on project_kickoffs for select to authenticated using (true);
create policy "Authenticated insert kickoffs" on project_kickoffs for insert to authenticated with check (true);
create policy "Authenticated update kickoffs" on project_kickoffs for update to authenticated using (true) with check (true);
create policy "Authenticated delete kickoffs" on project_kickoffs for delete to authenticated using (true);
