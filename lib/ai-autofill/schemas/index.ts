import type { DocumentSchema, DocumentType } from "../types";
import { receiptSchema } from "./receipt";
import { supplierInvoiceSchema } from "./supplier-invoice";
import { deliveryReceiptSchema } from "./delivery-receipt";
import { shippingLabelSchema } from "./shipping-label";
import { officialReceiptSchema } from "./official-receipt";

export const documentSchemas: Record<DocumentType, DocumentSchema> = {
  receipt: receiptSchema,
  supplier_invoice: supplierInvoiceSchema,
  delivery_receipt: deliveryReceiptSchema,
  shipping_label: shippingLabelSchema,
  official_receipt: officialReceiptSchema,
};

export {
  receiptSchema,
  supplierInvoiceSchema,
  deliveryReceiptSchema,
  shippingLabelSchema,
  officialReceiptSchema,
};
