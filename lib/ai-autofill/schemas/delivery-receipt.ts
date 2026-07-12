import type { DocumentSchema } from "../types";

export const deliveryReceiptSchema: DocumentSchema = {
  id: "delivery_receipt",
  label: "Delivery Receipt",
  headerFields: [
    { key: "supplier", label: "Supplier / Courier", type: "dropdown", localHints: ["Delivered By", "Courier", "Supplier"], required: true },
    { key: "date", label: "Date Received", type: "date", localHints: ["Date", "Date Received"], required: true },
    { key: "receivedBy", label: "Received By", type: "string", localHints: ["Received By"] },
    { key: "notes", label: "Notes", type: "string" },
  ],
  lineItemFields: [
    { key: "description", label: "Description", type: "string" },
    { key: "quantity", label: "Quantity", type: "number", localHints: ["Qty", "Quantity"] },
  ],
};
