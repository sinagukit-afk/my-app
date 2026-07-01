'use server'

import { createClient } from '@/lib/supabase/server'

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export type OrderItemSnapshot = {
  item_name_snapshot: string | null
  sku_snapshot: string | null
  quantity: number
  unit_price: number
  line_discount: number
}

export type OrderSnapshot = {
  customer_name: string | null
  note: string | null
  subtotal: number
  total_discount: number
  total_money: number
  items: OrderItemSnapshot[]
}

export type OrderDiffResult = {
  current: OrderSnapshot
  previousCustomerName: string | null
}

export async function getOrderDiffData(
  orderId: string,
  previousCustomerId: string | null
): Promise<OrderDiffResult | null> {
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select('note, subtotal, total_discount, total_money, customers(name)')
    .eq('id', orderId)
    .single()
  if (!order) return null

  const { data: items } = await supabase
    .from('order_items')
    .select('item_name_snapshot, sku_snapshot, quantity, unit_price, line_discount')
    .eq('order_id', orderId)

  let previousCustomerName: string | null = null
  if (previousCustomerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('name')
      .eq('id', previousCustomerId)
      .single()
    previousCustomerName = customer?.name ?? null
  }

  return {
    current: {
      customer_name: firstOf(order.customers)?.name ?? null,
      note: order.note,
      subtotal: order.subtotal,
      total_discount: order.total_discount,
      total_money: order.total_money,
      items: items ?? [],
    },
    previousCustomerName,
  }
}
