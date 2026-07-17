/**
 * Shared formatting for Chart of Accounts pickers used across the mapping
 * screens (Sales/Purchase/Inventory/Tax Mapping, Product Mapping, Expense
 * Categories, Payment Methods, Bank Accounts). Parent/header accounts
 * (is_postable = false) stay selectable in these dropdowns — hiding them
 * outright made it hard to see the full CoA tree while mapping — but the
 * label calls them out so the picking UI can also flag + block on them.
 */
export type PostableAccount = { account_number: string; name: string; is_postable: boolean };

export function accountOptionLabel(account: PostableAccount): string {
  return account.is_postable
    ? `${account.account_number} — ${account.name}`
    : `${account.account_number} — ${account.name} (Header — not postable)`;
}

export const PARENT_ACCOUNT_WARNING = "This is a parent/header account and can't be posted to — choose a postable account before saving.";
