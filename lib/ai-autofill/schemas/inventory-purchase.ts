import type { DocumentSchema } from "../types";
import { supplierInvoiceSchema } from "./supplier-invoice";

/**
 * Matches the header + line-item shape of the Inventory Purchase Order form
 * (app/dashboard/purchasing/inventory-po/new/new-po-form.tsx). Shares its
 * header fields with supplierInvoiceSchema (same supplier/date/shipping/note
 * shape), but line items match against registered item variants instead of
 * a free-text description + category — see match-dropdown.ts and the
 * "keywords" alias support on DropdownOption for how a supplier document's
 * wording gets matched to the registered item.
 *
 * unit_cost uses totalDividedBy: "quantity" because these documents are
 * often a marketplace order for a multi-piece pack (e.g. "50 pcs ... ₱650")
 * where the printed price is the pack TOTAL, not a per-piece rate — asking
 * the AI for that total and dividing by quantity in code avoids it
 * mistaking the pack price for the unit price (see openai-vision.ts).
 */
export const inventoryPurchaseSchema: DocumentSchema = {
  id: "inventory_purchase",
  label: "Delivery Invoice",
  headerFields: supplierInvoiceSchema.headerFields,
  lineItemFields: [
    { key: "variant_id", label: "Item", type: "dropdown" },
    { key: "quantity", label: "Quantity", type: "number", localHints: ["Qty", "Quantity"] },
    {
      key: "unit_cost",
      label: "Unit Cost",
      type: "currency",
      localHints: ["Unit Price", "Rate", "Unit Cost"],
      totalDividedBy: "quantity",
    },
    { key: "discount", label: "Discount", type: "currency", localHints: ["Discount"] },
  ],
};
