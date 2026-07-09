create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#36D17D',
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.payment_status as enum ('scheduled', 'paid', 'overdue');
create type public.repeat_rule as enum ('none', 'weekly', 'monthly', 'yearly');

create table if not exists public.payment_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  amount numeric(12, 2),
  currency text not null default 'RUB',
  date date not null,
  time time,
  comment text,
  status public.payment_status not null default 'scheduled',
  repeat_rule public.repeat_rule not null default 'none',
  notification_offsets text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.payment_items enable row level security;

create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id);

create policy "Users can manage own categories"
on public.categories for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own payment items"
on public.payment_items for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
