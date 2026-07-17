/**
 * Which accounts.category each system_account_mappings key's GL Account
 * picker should be filtered to. Keys/labels themselves live in the DB
 * (system_account_mappings, seeded by acct9_3_system_account_mappings);
 * this only maps each key to the account category it's semantically
 * expected to resolve to, so the Sales/Purchase/Inventory Mapping pages
 * can filter their pickers without hardcoding the label text.
 */
export const SALES_MAPPING_KEYS = ["tip_income", "write_off_expense"] as const;
export const PURCHASE_MAPPING_KEYS = [
  "credit_card_payable",
  "credit_card_interest_expense",
  "shipping_in_expense",
  "supplier_discount_expense",
] as const;
export const INVENTORY_MAPPING_KEYS = ["inventory_adjustment_gain", "inventory_adjustment_loss", "inventory_scrap"] as const;
export const TAX_MAPPING_KEYS = ["output_tax_payable"] as const;

export const MAPPING_KEY_ACCOUNT_CATEGORY: Record<string, string> = {
  tip_income: "revenue",
  write_off_expense: "expense",
  credit_card_payable: "liability",
  credit_card_interest_expense: "expense",
  shipping_in_expense: "expense",
  supplier_discount_expense: "expense",
  inventory_adjustment_gain: "expense",
  inventory_adjustment_loss: "expense",
  inventory_scrap: "expense",
  output_tax_payable: "liability",
};
