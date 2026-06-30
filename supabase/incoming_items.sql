create extension if not exists pgcrypto;

create table if not exists public.incoming_items (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id),
  variant_id uuid references public.item_variants(id),
  item_name_snapshot text not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  total_price numeric not null check (total_price >= 0),
  discount_amount numeric not null default 0,
  date_received date not null,
  order_id text,
  shipping_fee numeric not null default 0 check (shipping_fee >= 0),
  supplier text,
  source text not null default 'online',
  received_by uuid not null references auth.users(id),
  received_by_email text,
  created_at timestamptz not null default now()
);

alter table public.incoming_items enable row level security;

alter table public.incoming_items
add column if not exists discount_amount numeric not null default 0;

alter table public.incoming_items
add column if not exists variant_id uuid references public.item_variants(id);

create policy "Authenticated users can read incoming items"
on public.incoming_items
for select
to authenticated
using (true);

create policy "Authenticated users can add incoming items"
on public.incoming_items
for insert
to authenticated
with check (auth.uid() = received_by);
