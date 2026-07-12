import type { DocumentSchema } from "../types";

export const shippingLabelSchema: DocumentSchema = {
  id: "shipping_label",
  label: "Shipping Label",
  headerFields: [
    { key: "courier", label: "Courier", type: "dropdown", localHints: ["Courier", "Carrier"] },
    { key: "trackingNumber", label: "Tracking Number", type: "string", localHints: ["Tracking No", "Tracking Number", "AWB"], required: true },
    { key: "recipientName", label: "Recipient Name", type: "string", localHints: ["To", "Recipient", "Ship To"] },
    { key: "address", label: "Address", type: "string", localHints: ["Address"] },
    { key: "date", label: "Date", type: "date", localHints: ["Date"] },
  ],
};
