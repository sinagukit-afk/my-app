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
