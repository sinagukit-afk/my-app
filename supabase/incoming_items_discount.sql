alter table public.incoming_items
add column if not exists discount_amount numeric not null default 0;
