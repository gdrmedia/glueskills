-- Brand Packs v1: per-client brand data consumed by the Figma plugin.
-- See: docs/superpowers/plans/2026-04-21-brand-packs-web-admin.md

create table if not exists brands (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name              text not null,
  palette           jsonb not null,   -- { primary, secondary, accent?, neutral? }
  font              jsonb not null,   -- { family, fallback, weights: { bold, semi, regular } }
  logo_primary_url  text not null,
  logo_alt_url      text,
  images            jsonb,            -- array of { url, label?, sort_order } — max 5
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- updated_at trigger (no pre-existing pattern in this repo; introduced here).
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brands_set_updated_at on brands;
create trigger brands_set_updated_at
  before update on brands
  for each row execute function set_updated_at();

alter table brands enable row level security;

-- Public read: any visitor (and the Figma plugin anon call) can fetch a brand.
create policy "Anyone can read brands"
  on brands for select
  using (true);

-- Writes: any authenticated Clerk user = admin. (Matches the internal-tool
-- posture described in CLAUDE.md; there are no roles yet.)
create policy "Authenticated users can insert brands"
  on brands for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update brands"
  on brands for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete brands"
  on brands for delete
  to authenticated
  using (true);

-- Storage bucket for logos + imagery. Public-read; server actions with the
-- service-role key handle writes.
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;

-- Anyone can read (bucket is public; this is an explicit belt-and-braces policy).
drop policy if exists "Public read on brand-assets" on storage.objects;
create policy "Public read on brand-assets"
  on storage.objects for select
  using (bucket_id = 'brand-assets');
