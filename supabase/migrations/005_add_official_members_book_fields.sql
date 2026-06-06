alter table public.association_members
add column if not exists fiscal_code text null,
add column if not exists birth_date date null,
add column if not exists membership_card_number text null;

create index if not exists association_members_fiscal_code_lower_idx
on public.association_members (lower(fiscal_code))
where fiscal_code is not null;

create index if not exists association_members_birth_date_idx
on public.association_members (birth_date);
