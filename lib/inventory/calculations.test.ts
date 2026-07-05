import { describe, expect, it } from 'vitest'
import {
  getAvailableToSell,
  getOnHand,
  getProjectedStock,
  type InventoryStatusQuantities,
} from './calculations'

function row(overrides: Partial<InventoryStatusQuantities> = {}): InventoryStatusQuantities {
  return {
    available_qty: 0,
    reserved_qty: 0,
    in_production_qty: 0,
    on_hold_qty: 0,
    incoming_qty: 0,
    ...overrides,
  }
}

describe('getOnHand', () => {
  it('sums available, reserved, in_production, and on_hold, excluding incoming', () => {
    const r = row({ available_qty: 6, reserved_qty: 4, in_production_qty: 3, on_hold_qty: 2, incoming_qty: 100 })
    expect(getOnHand(r)).toBe(15)
  })
})

describe('getAvailableToSell', () => {
  it('returns available_qty only', () => {
    const r = row({ available_qty: 10, reserved_qty: 5 })
    expect(getAvailableToSell(r)).toBe(10)
  })
})

describe('getProjectedStock', () => {
  it('sums available_qty and incoming_qty', () => {
    const r = row({ available_qty: 6, incoming_qty: 5 })
    expect(getProjectedStock(r)).toBe(11)
  })
})

describe('On Hand invariant under a status_transfer', () => {
  it('is unchanged when quantity moves between two counted buckets (e.g. Available -> Reserved)', () => {
    const before = row({ available_qty: 10 })
    const onHandBefore = getOnHand(before)

    const transferQty = 4
    const after = row({
      available_qty: before.available_qty - transferQty,
      reserved_qty: before.reserved_qty + transferQty,
    })
    const onHandAfter = getOnHand(after)

    expect(onHandAfter).toBe(onHandBefore)
  })

  it('is unchanged for any pairwise transfer among available/reserved/in_production/on_hold', () => {
    const before = row({ available_qty: 5, reserved_qty: 3, in_production_qty: 2, on_hold_qty: 1 })
    const onHandBefore = getOnHand(before)

    const after: InventoryStatusQuantities = {
      ...before,
      in_production_qty: before.in_production_qty - 2,
      on_hold_qty: before.on_hold_qty + 2,
    }

    expect(getOnHand(after)).toBe(onHandBefore)
  })

  it('does change when incoming becomes available (not a status_transfer, out of scope for Phase 1)', () => {
    const before = row({ available_qty: 5, incoming_qty: 5 })
    const onHandBefore = getOnHand(before)
    const after = row({ available_qty: 10, incoming_qty: 0 })
    expect(getOnHand(after)).toBe(onHandBefore + 5)
  })
})
