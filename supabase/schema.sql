create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'owner',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  city text not null default 'Bengaluru',
  area text not null,
  type text not null check (type in ('pg', 'hostel', 'co-living')),
  rent numeric(10,2) not null default 0,
  phone text,
  image_url text,
  rooms_available integer not null default 1,
  amenities text[] not null default '{}',
  status text not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.properties enable row level security;

create policy "Public profiles are viewable" on public.profiles for select using (true);
create policy "Owners can manage their own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "Public properties are viewable" on public.properties for select using (true);
create policy "Owners can manage their own properties" on public.properties for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.handle_updated_at();

create trigger set_properties_updated_at
before update on public.properties
for each row execute procedure public.handle_updated_at();
