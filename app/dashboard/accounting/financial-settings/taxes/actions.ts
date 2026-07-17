'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { findNonPostableAccounts } from '@/lib/accounting/assert-postable-accounts'

export type ActionResult = { success: true } | { success: false; error: string }
export type MappingInput = { mapping_key: string; account_id: string | null }
export type SaveResult = { success: true } | { success: false; error: string }

const LIST_PATH = '/dashboard/accounting/financial-settings/taxes'

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '42501') return 'You do not have permission to edit Taxes.'
  if (error.code === '23503') return 'Selected account no longer exists.'
  return error.message
}

function readTaxRateFields(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const rate_percent = Number(formData.get('rate_percent'))
  return { name, rate_percent }
}

function validate(fields: ReturnType<typeof readTaxRateFields>): string | null {
  if (!fields.name) return 'Name is required.'
  if (!Number.isFinite(fields.rate_percent) || fields.rate_percent < 0 || fields.rate_percent > 100) {
    return 'Rate must be a number between 0 and 100.'
  }
  return null
}

export async function createTaxRate(formData: FormData): Promise<ActionResult> {
  const fields = readTaxRateFields(formData)
  const validationError = validate(fields)
  if (validationError) return { success: false, error: validationError }

  const supabase = await createClient()
  const { error } = await supabase.from('tax_rates').insert(fields)

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function updateTaxRate(id: string, formData: FormData): Promise<ActionResult> {
  const fields = readTaxRateFields(formData)
  const validationError = validate(fields)
  if (validationError) return { success: false, error: validationError }

  const supabase = await createClient()
  const { error } = await supabase.from('tax_rates').update(fields).eq('id', id)

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function setTaxRateActive(id: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('tax_rates').update({ is_active: isActive }).eq('id', id)

  if (error) return { success: false, error: friendlyError(error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}

export async function saveTaxMapping(rows: MappingInput[]): Promise<SaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated.' }

  const postableError = await findNonPostableAccounts(supabase, rows.map((r) => r.account_id))
  if (postableError) return { success: false, error: postableError }

  const results = await Promise.all(
    rows.map((r) =>
      supabase
        .from('system_account_mappings')
        .update({ account_id: r.account_id, updated_by: user.id })
        .eq('mapping_key', r.mapping_key)
    )
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) return { success: false, error: friendlyError(failed.error) }

  revalidatePath(LIST_PATH)
  return { success: true }
}
