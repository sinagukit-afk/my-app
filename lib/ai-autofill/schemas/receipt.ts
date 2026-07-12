import type { DocumentSchema } from "../types";

export const receiptSchema: DocumentSchema = {
  id: "receipt",
  label: "Receipt",
  headerFields: [
    { key: "supplier", label: "Supplier", type: "dropdown", localHints: ["Sold By", "Store", "Merchant"], required: true },
    { key: "date", label: "Date", type: "date", localHints: ["Date"], required: true },
    { key: "amount", label: "Amount", type: "currency", localHints: ["Total", "Amount Due", "Grand Total"], required: true },
    { key: "category", label: "Expense Category", type: "dropdown" },
    { key: "paymentMethod", label: "Payment Method", type: "dropdown", localHints: ["Cash", "Card", "GCash", "Payment"] },
    { key: "notes", label: "Notes", type: "string" },
  ],
};
