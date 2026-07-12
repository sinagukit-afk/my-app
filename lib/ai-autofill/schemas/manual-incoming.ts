import type { DocumentSchema } from "../types";

/**
 * Matches the header + line-item shape of the Manual Incoming form
 * (app/dashboard/purchasing/receiving/new/new-manual-incoming-form.tsx).
 * Line items match against registered item variants the same way
 * inventoryPurchaseSchema does — see match-dropdown.ts and the "keywords"
 * alias support on DropdownOption.
 *
 * unit_price uses totalDividedBy: "quantity" for the same reason as
 * inventoryPurchaseSchema's unit_cost: these are often marketplace/delivery
 * screenshots showing a multi-piece pack's TOTAL price rather than a
 * per-piece rate (see openai-vision.ts).
 */
export const manualIncomingSchema: DocumentSchema = {
  id: "manual_incoming",
  label: "Delivery Invoice",
  headerFields: [
    { key: "supplier_id", label: "Supplier", type: "dropdown", localHints: ["Sold By", "Supplier", "Vendor", "From"], required: true },
    { key: "date_received", label: "Date Received", type: "date", localHints: ["Date", "Date Received"], required: true },
    { key: "note", label: "Notes", type: "string" },
  ],
  lineItemFields: [
    { key: "variant_id", label: "Item", type: "dropdown" },
    { key: "quantity", label: "Quantity", type: "number", localHints: ["Qty", "Quantity"] },
    {
      key: "unit_price",
      label: "Unit Price",
      type: "currency",
      localHints: ["Unit Price", "Rate", "Unit Cost"],
      totalDividedBy: "quantity",
    },
  ],
};
