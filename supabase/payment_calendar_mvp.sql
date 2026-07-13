create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('scheduled', 'paid', 'overdue');
  end if;
end $$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#36D17D',
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  amount numeric(12, 2),
  currency text not null default 'RUB',
  date date not null,
  comment text,
  status public.payment_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_user_id_idx
on public.categories(user_id);

create index if not exists payment_items_user_date_idx
on public.payment_items(user_id, date);

alter table public.categories enable row level security;
alter table public.payment_items enable row level security;

drop policy if exists "Users can manage own categories" on public.categories;
create policy "Users can manage own categories"
on public.categories
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own payment items" on public.payment_items;

drop policy if exists "Users can read own payment items" on public.payment_items;
create policy "Users can read own payment items"
on public.payment_items
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own payment items" on public.payment_items;
create policy "Users can create own payment items"
on public.payment_items
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own payment items" on public.payment_items;
create policy "Users can update own payment items"
on public.payment_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own payment items" on public.payment_items;
create policy "Users can delete own payment items"
on public.payment_items
for delete
using (auth.uid() = user_id);
