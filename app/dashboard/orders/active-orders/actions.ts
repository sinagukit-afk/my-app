'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { fetchOrderRows } from './queries'
import type { OrderRow } from './order-list-table'
import { formatCurrency } from '@/lib/utils/format'

export type ActionResult =
  | { success: true; orderId?: string; orderNumber?: string }
  | { success: false; error: string }

const LIST_PATH = '/dashboard/orders/active-orders'

export async function exportOrders(from: string, to: string): Promise<{ rows: OrderRow[]; error: string | null }> {
  return fetchOrderRows(from, to)
}

export type OrderItemInput = {
  id?: string
  variant_id: string
  item_name_snapshot: string
  sku_snapshot: string | null
  quantity: number
  unit_price: number
  discount_id: string | null
  line_discount: number
  modifiers: { modifier_id: string; modifier_option_id: string; name_snapshot: string; price_snapshot: number }[]
}

export async function createOrder(formData: FormData): Promise<ActionResult> {
  const customer_id = (formData.get('customer_id') as string) || null
  const note = (formData.get('note') as string)?.trim() || null
  const same_as_customer = formData.get('same_as_customer') !== 'false'
  const receiver_name = (formData.get('receiver_name') as string)?.trim() || null
  const target_date = formData.get('target_date') as string
  const fulfillment_method = (formData.get('fulfillment_method') as string) || null

  if (!target_date) {
    return { success: false, error: 'Target date is required.' }
  }

  if (!same_as_customer && !receiver_name) {
    return { success: false, error: 'Receiver name is required when shipping to someone other than the customer.' }
  }

  let items: OrderItemInput[] = []
  try {
    items = JSON.parse((formData.get('items_json') as string) || '[]')
  } catch {
    return { success: false, error: 'Invalid line item data.' }
  }

  const validItems = items.filter((i) => i.variant_id && i.quantity > 0)
  if (validItems.length === 0) {
    return { success: false, error: 'Add at least one line item with a quantity greater than zero.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_order', {
    p_lines: validItems,
    p_target_date: target_date,
    p_customer_id: customer_id,
    p_note: note,
    p_same_as_customer: same_as_customer,
    p_receiver_name: same_as_customer ? null : receiver_name,
    p_receiver_phone: same_as_customer ? null : (formData.get('receiver_phone') as string)?.trim() || null,
    p_receiver_address_line1: same_as_customer
      ? null
      : (formData.get('receiver_address_line1') as string)?.trim() || null,
    p_receiver_barangay: same_as_customer ? null : (formData.get('receiver_barangay') as string)?.trim() || null,
    p_receiver_city: same_as_customer ? null : (formData.get('receiver_city') as string)?.trim() || null,
    p_receiver_province: same_as_customer ? null : (formData.get('receiver_province') as string)?.trim() || null,
    p_receiver_postal_code: same_as_customer
      ? null
      : (formData.get('receiver_postal_code') as string)?.trim() || null,
    p_fulfillment_method: fulfillment_method,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/inventory/monitoring')
  return { success: true, orderId: data.id, orderNumber: data.order_number }
}

export async function adjustOrderItems(orderId: string, formData: FormData): Promise<ActionResult> {
  const customer_id = (formData.get('customer_id') as string) || null
  const note = (formData.get('note') as string)?.trim() || null
  const same_as_customer = formData.get('same_as_customer') !== 'false'
  const receiver_name = (formData.get('receiver_name') as string)?.trim() || null
  const fulfillment_method = (formData.get('fulfillment_method') as string) || null

  if (!same_as_customer && !receiver_name) {
    return { success: false, error: 'Receiver name is required when shipping to someone other than the customer.' }
  }

  let items: OrderItemInput[] = []
  try {
    items = JSON.parse((formData.get('items_json') as string) || '[]')
  } catch {
    return { success: false, error: 'Invalid line item data.' }
  }

  const validItems = items.filter((i) => i.variant_id && i.quantity > 0)
  if (validItems.length === 0) {
    return { success: false, error: 'Add at least one line item with a quantity greater than zero.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('adjust_order_items', {
    p_order_id: orderId,
    p_lines: validItems,
    p_customer_id: customer_id,
    p_note: note,
    p_same_as_customer: same_as_customer,
    p_receiver_name: same_as_customer ? null : receiver_name,
    p_receiver_phone: same_as_customer ? null : (formData.get('receiver_phone') as string)?.trim() || null,
    p_receiver_address_line1: same_as_customer
      ? null
      : (formData.get('receiver_address_line1') as string)?.trim() || null,
    p_receiver_barangay: same_as_customer ? null : (formData.get('receiver_barangay') as string)?.trim() || null,
    p_receiver_city: same_as_customer ? null : (formData.get('receiver_city') as string)?.trim() || null,
    p_receiver_province: same_as_customer ? null : (formData.get('receiver_province') as string)?.trim() || null,
    p_receiver_postal_code: same_as_customer
      ? null
      : (formData.get('receiver_postal_code') as string)?.trim() || null,
    p_fulfillment_method: fulfillment_method,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath('/dashboard/inventory/monitoring')
  return { success: true }
}

export async function startProduction(orderId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('start_production', { p_order_id: orderId })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${orderId}`)
  revalidatePath('/dashboard/orders/production')
  revalidatePath('/dashboard/orders/confirmed')
  revalidatePath('/dashboard/inventory/monitoring')
  return { success: true }
}

export async function overrideReservedQty(
  orderId: string,
  updates: { orderItemId: string; reservedQty: number }[]
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('override_reserved_qty', {
    p_order_id: orderId,
    p_updates: updates.map((u) => ({ order_item_id: u.orderItemId, reserved_qty: u.reservedQty })),
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`${LIST_PATH}/${orderId}`)
  revalidatePath('/dashboard/inventory/monitoring')
  return { success: true }
}

export type AddPaymentInput = {
  paymentDate: string
  amount: number
  paymentTypeId: string | null
  referenceNo: string | null
}

export async function addOrderPayment(orderId: string, payment: AddPaymentInput): Promise<ActionResult> {
  if (!(payment.amount > 0)) {
    return { success: false, error: 'Amount must be greater than zero.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('order_payments').insert({
    order_id: orderId,
    payment_date: payment.paymentDate,
    amount: payment.amount,
    payment_type_id: payment.paymentTypeId,
    reference_no: payment.referenceNo?.trim() || null,
  })

  if (error) return { success: false, error: error.message }

  await supabase.from('activity_logs').insert({
    user_id: user?.id ?? null,
    action: 'order_payment_added',
    entity_type: 'order',
    entity_id: orderId,
    description: `Payment recorded — ${formatCurrency(payment.amount)}`,
  })

  revalidatePath(`${LIST_PATH}/${orderId}`)
  return { success: true }
}

export async function closeOrderPayment(orderId: string, orderNumber: string, note: string | null): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('close_order_payment', { p_order_id: orderId, p_note: note })

  if (error) return { success: false, error: error.message }

  revalidatePath(`${LIST_PATH}/${orderId}`)
  revalidatePath(`/dashboard/finance/payments/${orderNumber}`)
  revalidatePath(`/dashboard/finance/payments/${orderNumber}/preview`)
  return { success: true }
}

async function callOrderStatusRpc(orderId: string, rpc: string, args: Record<string, unknown> = {}): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc(rpc, { p_order_id: orderId, ...args })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${orderId}`)
  revalidatePath('/dashboard/inventory/monitoring')
  return { success: true }
}

export async function cancelOrder(orderId: string): Promise<ActionResult> {
  return callOrderStatusRpc(orderId, 'cancel_order')
}

export async function holdOrder(orderId: string): Promise<ActionResult> {
  return callOrderStatusRpc(orderId, 'hold_order')
}

export async function resumeOrder(orderId: string): Promise<ActionResult> {
  return callOrderStatusRpc(orderId, 'resume_order')
}

export type CreateShipmentInput = {
  fulfillmentType: 'pickup' | 'delivery'
  shipsToCustomer: boolean
  receiverName: string | null
  receiverPhone: string | null
  receiverAddressLine1: string | null
  receiverBarangay: string | null
  receiverCity: string | null
  receiverProvince: string | null
  receiverPostalCode: string | null
  courierId: string | null
  trackingNumber: string | null
  shippingCost: number | null
  shippingFeeCharged: number | null
  courierPaymentTypeId: string | null
  note: string | null
  items: { orderItemId: string; quantityShipped: number }[]
  packagingItems: { variantId: string; quantityUsed: number }[]
}

export async function createShipment(orderId: string, input: CreateShipmentInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('create_shipment', {
    p_order_id: orderId,
    p_courier_id: input.courierId,
    p_tracking_number: input.trackingNumber,
    p_shipping_cost: input.shippingCost,
    p_shipping_fee_charged: input.shippingFeeCharged,
    p_courier_payment_type_id: input.courierPaymentTypeId,
    p_note: input.note,
    p_items: input.items.map((i) => ({ order_item_id: i.orderItemId, quantity_shipped: i.quantityShipped })),
    p_packaging_items: input.packagingItems.map((p) => ({ variant_id: p.variantId, quantity_used: p.quantityUsed })),
    p_fulfillment_type: input.fulfillmentType,
    p_ships_to_customer: input.shipsToCustomer,
    p_receiver_name: input.receiverName,
    p_receiver_phone: input.receiverPhone,
    p_receiver_address_line1: input.receiverAddressLine1,
    p_receiver_barangay: input.receiverBarangay,
    p_receiver_city: input.receiverCity,
    p_receiver_province: input.receiverProvince,
    p_receiver_postal_code: input.receiverPostalCode,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${orderId}`)
  revalidatePath('/dashboard/orders/shipping')
  revalidatePath('/dashboard/inventory/monitoring')
  return { success: true }
}

export async function updateShipment(
  orderId: string,
  shipmentId: string,
  input: CreateShipmentInput
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('update_shipment', {
    p_shipment_id: shipmentId,
    p_courier_id: input.courierId,
    p_tracking_number: input.trackingNumber,
    p_shipping_cost: input.shippingCost,
    p_shipping_fee_charged: input.shippingFeeCharged,
    p_courier_payment_type_id: input.courierPaymentTypeId,
    p_note: input.note,
    p_items: input.items.map((i) => ({ order_item_id: i.orderItemId, quantity_shipped: i.quantityShipped })),
    p_packaging_items: input.packagingItems.map((p) => ({ variant_id: p.variantId, quantity_used: p.quantityUsed })),
    p_fulfillment_type: input.fulfillmentType,
    p_ships_to_customer: input.shipsToCustomer,
    p_receiver_name: input.receiverName,
    p_receiver_phone: input.receiverPhone,
    p_receiver_address_line1: input.receiverAddressLine1,
    p_receiver_barangay: input.receiverBarangay,
    p_receiver_city: input.receiverCity,
    p_receiver_province: input.receiverProvince,
    p_receiver_postal_code: input.receiverPostalCode,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${orderId}`)
  revalidatePath('/dashboard/orders/shipping')
  revalidatePath('/dashboard/inventory/monitoring')
  return { success: true }
}

export async function markShipmentShipped(orderId: string, shipmentId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_shipment_shipped', { p_shipment_id: shipmentId })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${orderId}`)
  revalidatePath('/dashboard/orders/shipping')
  revalidatePath('/dashboard/inventory/monitoring')
  return { success: true }
}

export async function markShipmentDelivered(orderId: string, shipmentId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_shipment_delivered', { p_shipment_id: shipmentId })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${orderId}`)
  revalidatePath('/dashboard/orders/shipping')
  return { success: true }
}

export async function markShipmentPickedUp(orderId: string, shipmentId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_shipment_picked_up', { p_shipment_id: shipmentId })

  if (error) return { success: false, error: error.message }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${orderId}`)
  revalidatePath('/dashboard/orders/shipping')
  revalidatePath('/dashboard/inventory/monitoring')
  return { success: true }
}
