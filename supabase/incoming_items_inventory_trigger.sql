-- Adds variant tracking to incoming item receipts and automatically updates
-- inventory_levels + inventory_movements whenever a new incoming item is saved.

alter table public.incoming_items
add column if not exists variant_id uuid references public.item_variants(id);

update public.incoming_items incoming
set variant_id = variant.id
from public.item_variants variant
where incoming.variant_id is null
  and variant.item_id = incoming.item_id;

create unique index if not exists inventory_levels_variant_store_key
on public.inventory_levels (variant_id, store_id);

alter table public.inventory_movements
drop constraint if exists inventory_movements_movement_type_check;

alter table public.inventory_movements
add constraint inventory_movements_movement_type_check
check (
  movement_type in (
    'initial_sync',
    'incoming',
    'sale',
    'adjustment',
    'manual_adjustment'
  )
);

create or replace function public.apply_incoming_item_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_variant_id uuid;
  resolved_store_id uuid;
  resolved_source_id uuid;
  new_quantity numeric;
begin
  resolved_variant_id := new.variant_id;

  if resolved_variant_id is null then
    select variant.id
    into resolved_variant_id
    from public.item_variants variant
    where variant.item_id = new.item_id
      and variant.deleted_at is null
    order by variant.created_at asc
    limit 1;
  end if;

  if resolved_variant_id is null then
    raise exception 'No item variant found for incoming item %', new.item_id;
  end if;

  select store.id
  into resolved_store_id
  from public.stores store
  where store.is_active = true
  order by store.created_at asc
  limit 1;

  if resolved_store_id is null then
    raise exception 'No active store found for incoming inventory movement';
  end if;

  select source.id
  into resolved_source_id
  from public.inventory_sources source
  where source.code = 'manual'
  limit 1;

  if resolved_source_id is null then
    insert into public.inventory_sources (code, name, is_active)
    values ('manual', 'Manual Receiving', true)
    returning id into resolved_source_id;
  end if;

  insert into public.inventory_levels (
    variant_id,
    store_id,
    in_stock,
    source_id,
    source_updated_at,
    synced_at,
    created_at,
    updated_at
  )
  values (
    resolved_variant_id,
    resolved_store_id,
    new.quantity,
    resolved_source_id,
    coalesce(new.date_received::timestamptz, now()),
    now(),
    now(),
    now()
  )
  on conflict (variant_id, store_id)
  do update set
    in_stock = public.inventory_levels.in_stock + excluded.in_stock,
    source_id = excluded.source_id,
    source_updated_at = excluded.source_updated_at,
    synced_at = now(),
    updated_at = now()
  returning in_stock into new_quantity;

  insert into public.inventory_movements (
    variant_id,
    store_id,
    source_id,
    movement_type,
    quantity_change,
    quantity_after,
    source_reference_id,
    note,
    occurred_at
  )
  values (
    resolved_variant_id,
    resolved_store_id,
    resolved_source_id,
    'incoming',
    new.quantity,
    new_quantity,
    new.id,
    concat_ws(
      ' / ',
      nullif(new.item_name_snapshot, ''),
      nullif(new.source, ''),
      nullif(new.supplier, ''),
      case
        when nullif(new.order_id, '') is null then null
        else concat('Order ', new.order_id)
      end
    ),
    coalesce(new.date_received::timestamptz, now())
  );

  if new.variant_id is null then
    update public.incoming_items
    set variant_id = resolved_variant_id
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists incoming_items_apply_inventory_movement on public.incoming_items;

create trigger incoming_items_apply_inventory_movement
after insert on public.incoming_items
for each row
execute function public.apply_incoming_item_inventory_movement();
