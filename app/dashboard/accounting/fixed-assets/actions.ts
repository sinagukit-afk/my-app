'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const LIST_PATH = '/dashboard/accounting/fixed-assets'

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
    .select('id, name, cost, useful_life_months, purchased_date, disposed_at')
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
    const alreadyDepreciated = totalsByAsset.get(a.id) ?? 0
    const monthly = Math.round((cost / a.useful_life_months) * 100) / 100
    if (alreadyDepreciated + monthly > cost) continue // matches the RPC's "<= cost" guard
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
