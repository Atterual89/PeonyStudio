create table if not exists public.association_members (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  email text null,
  contact text null,
  membership_status text default 'verified',
  membership_starts_at date,
  membership_expires_at date,
  source text default 'google_sheet',
  source_row_id text null,
  source_hash text null,
  notes_admin text null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists association_members_email_lower_idx
on public.association_members (lower(email))
where email is not null;

create index if not exists association_members_name_lower_idx
on public.association_members (lower(first_name), lower(last_name));

create index if not exists association_members_source_row_id_idx
on public.association_members (source_row_id);
