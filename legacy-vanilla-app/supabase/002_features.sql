-- StayNest enhancement migration: run this in the Supabase SQL editor
-- (Project -> SQL Editor -> New query) AFTER schema.sql has already been applied.
-- Adds: tenant phone on profiles, wishlists, reviews, enquiries.

-- Tenants sign in by phone (owners sign in by email); profiles needs a phone column.
alter table public.profiles add column if not exists phone text;

-- ---------------------------------------------------------------------------
-- wishlists: a tenant/owner "saving" a stay for later.
-- stay_id is TEXT, not a foreign key to properties, because most stays in the
-- app are rows from the static Bangalore dataset (data/bangalore-pgs.js), not
-- database rows -- only owner-listed properties live in public.properties.
-- ---------------------------------------------------------------------------
create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stay_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, stay_id)
);

alter table public.wishlists enable row level security;

create policy "Users can view their own wishlist" on public.wishlists
  for select using (user_id = auth.uid());
create policy "Users can add to their own wishlist" on public.wishlists
  for insert with check (user_id = auth.uid());
create policy "Users can remove from their own wishlist" on public.wishlists
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- reviews: public reviews on any stay (static dataset PG or owner-listed
-- property). Previously stored per-browser in localStorage; now centralized
-- so reviews persist across devices and are visible to every visitor.
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  stay_id text not null,
  reviewer_name text not null,
  rating integer not null check (rating between 1 and 5),
  review_text text not null,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

create policy "Reviews are publicly viewable" on public.reviews
  for select using (true);
create policy "Anyone can leave a review" on public.reviews
  for insert with check (
    char_length(reviewer_name) between 1 and 60
    and char_length(review_text) between 1 and 500
  );

-- ---------------------------------------------------------------------------
-- enquiries: a tenant asking an owner about a stay ("Request a callback").
-- Anyone can submit one (no login required). Only the owner of the matching
-- database-backed property can read the enquiries addressed to them; leads
-- about static-dataset PGs (which have no owner account) are stored but not
-- surfaced anywhere yet.
-- ---------------------------------------------------------------------------
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  stay_id text not null,
  stay_name text,
  name text not null,
  phone text not null,
  message text,
  created_at timestamptz not null default now()
);

alter table public.enquiries enable row level security;

create policy "Anyone can submit an enquiry" on public.enquiries
  for insert with check (
    char_length(name) between 1 and 60
    and char_length(phone) between 6 and 20
  );
create policy "Owners can view enquiries for their own properties" on public.enquiries
  for select using (
    exists (
      select 1 from public.properties p
      where p.id::text = enquiries.stay_id
        and p.owner_id = auth.uid()
    )
  );

-- Note: api/enquiries.js reads with the service-role key (bypasses RLS) when
-- listing an owner's enquiries server-side, so this select policy mainly
-- protects any future direct-from-browser reads via the anon key.
