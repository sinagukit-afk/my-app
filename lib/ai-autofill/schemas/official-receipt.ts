import type { DocumentSchema } from "../types";

export const officialReceiptSchema: DocumentSchema = {
  id: "official_receipt",
  label: "Official Receipt",
  headerFields: [
    { key: "payer", label: "Payer", type: "dropdown", localHints: ["Received From", "Payer"] },
    { key: "orNumber", label: "OR Number", type: "string", localHints: ["OR No", "Official Receipt No", "Receipt No"], required: true },
    { key: "date", label: "Date", type: "date", localHints: ["Date"], required: true },
    { key: "amount", label: "Amount", type: "currency", localHints: ["Amount", "Total"], required: true },
    { key: "paymentMethod", label: "Payment Method", type: "dropdown", localHints: ["Cash", "Check", "Bank Transfer"] },
    { key: "notes", label: "Notes", type: "string" },
  ],
};
