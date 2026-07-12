import type { DocumentSchema } from "../types";

/**
 * Matches the header + line-item shape shared by the Expense PO and Asset PO
 * forms (app/dashboard/purchasing/{expense-po,asset-po}/new/*). The host form
 * maps the generic "category_id" line-item key to its own
 * expense_category_id / asset_category_id.
 */
export const supplierInvoiceSchema: DocumentSchema = {
  id: "supplier_invoice",
  label: "Supplier Invoice",
  headerFields: [
    { key: "supplier_id", label: "Supplier", type: "dropdown", localHints: ["Sold By", "Supplier", "Vendor", "From"], required: true },
    { key: "order_date", label: "Invoice Date", type: "date", localHints: ["Date", "Invoice Date"], required: true },
    { key: "shipping_fee", label: "Shipping Fee", type: "currency", localHints: ["Shipping", "Freight", "Delivery Fee"] },
    { key: "note", label: "Notes", type: "string" },
  ],
  lineItemFields: [
    { key: "category_id", label: "Category", type: "dropdown" },
    { key: "description", label: "Description", type: "string" },
    { key: "quantity", label: "Quantity", type: "number", localHints: ["Qty", "Quantity"] },
    { key: "unit_cost", label: "Unit Cost", type: "currency", localHints: ["Unit Price", "Rate", "Unit Cost"] },
    { key: "discount", label: "Discount", type: "currency", localHints: ["Discount"] },
  ],
};
