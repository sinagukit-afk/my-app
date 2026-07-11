'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const LIST_PATH = '/dashboard/finance/fixed-assets'

export type DepreciationPreviewLine = {
  fixed_asset_id: string
  name: string
  cost: number
  already_depreciated: number
  monthly_amount: number
}

export type PreviewResult =
  | { success: true; periodStart: string; lines: DepreciationPreviewLine[] }
  | { success: false; error: string }

export type RunResult = { success: true; posted: number } | { success: false; error: string }

function firstOfMonth(period: string): string {
  return `${period.slice(0, 7)}-01`
}

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '42501') return 'You do not have permission for this action.'
  // post_journal_entry() / run_monthly_depreciation() raise plpgsql exceptions
  // (not authorized, unbalanced, etc.) — surface their message text directly.
  return error.message
}

// Read-only preview mirroring run_monthly_depreciation()'s selection + rounding
// logic exactly, so what the dialog shows is what the RPC will actually post.
export async function previewDepreciation(period: string): Promise<PreviewResult> {
  const supabase = await createClient()
  const periodStart = firstOfMonth(period)

  const { data: assets, error: assetsError } = await supabase
    .from('fixed_assets')
    .select('id, name, cost, salvage_value, useful_life_months, purchased_date, disposed_at')
    .is('disposed_at', null)
    .lte('purchased_date', periodStart)

  if (assetsError) return { success: false, error: friendlyError(assetsError) }

  const { data: entries, error: entriesError } = await supabase
    .from('depreciation_entries')
    .select('fixed_asset_id, period_month, amount')

  if (entriesError) return { success: false, error: friendlyError(entriesError) }

  const alreadyPostedThisPeriod = new Set(
    (entries ?? []).filter((e) => e.period_month === periodStart).map((e) => e.fixed_asset_id)
  )
  const totalsByAsset = new Map<string, number>()
  for (const e of entries ?? []) {
    totalsByAsset.set(e.fixed_asset_id, (totalsByAsset.get(e.fixed_asset_id) ?? 0) + Number(e.amount))
  }

  const lines: DepreciationPreviewLine[] = []
  for (const a of assets ?? []) {
    if (alreadyPostedThisPeriod.has(a.id)) continue
    const cost = Number(a.cost)
    const depreciableBase = cost - Number(a.salvage_value ?? 0)
    const alreadyDepreciated = totalsByAsset.get(a.id) ?? 0
    const monthly = Math.round((depreciableBase / a.useful_life_months) * 100) / 100
    if (alreadyDepreciated + monthly > depreciableBase) continue // matches the RPC's "<= depreciable base" guard
    if (monthly <= 0) continue
    lines.push({ fixed_asset_id: a.id, name: a.name, cost, already_depreciated: alreadyDepreciated, monthly_amount: monthly })
  }

  return { success: true, periodStart, lines }
}

export async function runDepreciation(period: string): Promise<RunResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('run_monthly_depreciation', { p_period: firstOfMonth(period) })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true, posted: (data ?? []).length }
}

export type ActionResult = { success: true } | { success: false; error: string }

export async function createFixedAsset(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const category_id = formData.get('category_id') as string
  const name = (formData.get('name') as string)?.trim()
  const purchased_date = formData.get('purchased_date') as string
  const cost = Number(formData.get('cost'))
  const salvage_value = Number(formData.get('salvage_value') ?? 0) || 0
  const useful_life_months = Number(formData.get('useful_life_months'))
  const supplier_id = (formData.get('supplier_id') as string) || null

  if (!category_id) return { success: false, error: 'Select an asset category.' }
  if (!name) return { success: false, error: 'Enter an asset name.' }
  if (!cost || cost <= 0) return { success: false, error: 'Cost must be greater than zero.' }
  if (!useful_life_months || useful_life_months <= 0) {
    return { success: false, error: 'Useful life (months) must be greater than zero.' }
  }

  const { data: category, error: categoryError } = await supabase
    .from('asset_categories')
    .select('default_asset_account_id, default_accum_depreciation_account_id, default_depreciation_expense_account_id')
    .eq('id', category_id)
    .single()

  if (categoryError || !category) return { success: false, error: 'Asset category not found.' }
  if (
    !category.default_asset_account_id ||
    !category.default_accum_depreciation_account_id ||
    !category.default_depreciation_expense_account_id
  ) {
    return { success: false, error: 'This asset category has no mapped accounts yet — set them in Category Mapping first.' }
  }

  const { error } = await supabase.from('fixed_assets').insert({
    category_id,
    asset_account_id: category.default_asset_account_id,
    accum_depreciation_account_id: category.default_accum_depreciation_account_id,
    depreciation_expense_account_id: category.default_depreciation_expense_account_id,
    name,
    purchased_date,
    cost,
    salvage_value,
    useful_life_months,
    supplier_id,
  })

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function updateFixedAsset(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const name = (formData.get('name') as string)?.trim()
  const purchased_date = formData.get('purchased_date') as string
  const cost = Number(formData.get('cost'))
  const salvage_value = Number(formData.get('salvage_value') ?? 0) || 0
  const useful_life_months = Number(formData.get('useful_life_months'))
  const supplier_id = (formData.get('supplier_id') as string) || null

  if (!name) return { success: false, error: 'Enter an asset name.' }
  if (!cost || cost <= 0) return { success: false, error: 'Cost must be greater than zero.' }
  if (!useful_life_months || useful_life_months <= 0) {
    return { success: false, error: 'Useful life (months) must be greater than zero.' }
  }

  const { error } = await supabase
    .from('fixed_assets')
    .update({ name, purchased_date, cost, salvage_value, useful_life_months, supplier_id })
    .eq('id', id)

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function disposeFixedAsset(id: string, disposedDate: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('fixed_assets').update({ disposed_at: disposedDate }).eq('id', id)

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}
