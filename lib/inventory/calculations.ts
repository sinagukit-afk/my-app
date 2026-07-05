import type { Database } from '@/lib/supabase/types'

type InventoryLevelRow = Database['public']['Tables']['inventory_levels']['Row']

export type InventoryStatusQuantities = Pick<
  InventoryLevelRow,
  'available_qty' | 'reserved_qty' | 'in_production_qty' | 'on_hold_qty' | 'incoming_qty'
>

export function getOnHand(row: InventoryStatusQuantities): number {
  return row.available_qty + row.reserved_qty + row.in_production_qty + row.on_hold_qty
}

export function getAvailableToSell(row: InventoryStatusQuantities): number {
  return row.available_qty
}

export function getProjectedStock(row: InventoryStatusQuantities): number {
  return row.available_qty + row.incoming_qty
}
