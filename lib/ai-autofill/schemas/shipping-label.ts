import type { DocumentSchema } from "../types";

/**
 * Matches the Add Shipment page's fields
 * (app/dashboard/orders/active-orders/[orderNumber]/shipments/new/new-shipment-form.tsx).
 * Courier labels (J&T, LBC, etc.) print the receiver's address as one
 * cramped line in a non-standard order (e.g. Province, City, Barangay,
 * Purok) — the AI vision pass reasons over the address hierarchy from the
 * image directly rather than relying on the local regex pass to split it,
 * so real photos are expected to escalate to the AI fallback most of the
 * time (see confidence.ts).
 *
 * Every `receiver*` field carries an explicit `description` because the key
 * name alone wasn't enough: the AI vision pass was observed pulling the
 * SENDER's name/address into these fields instead, since a courier label
 * prints both a sender/return-address block and a receiver/consignee block
 * with similar layout and font. The description spells out "not the sender"
 * for each one so the model can't default to whichever block it reads first.
 *
 * There's no separate Barangay/Postal Code field in the form — the address
 * hierarchy (barangay, city, province) is combined into one free-text
 * receiverAddressLine1, so the description tells the model to fold barangay
 * in there instead of dropping it.
 */
const NOT_SENDER = "This is the RECEIVER/consignee — the person and address this parcel is being delivered TO. The label also prints a separate SENDER/return-address block (often the shop's own address); never use that one here.";

export const shippingLabelSchema: DocumentSchema = {
  id: "shipping_label",
  label: "Shipping Label",
  headerFields: [
    { key: "courierId", label: "Courier", type: "dropdown", localHints: ["Courier", "Carrier"] },
    { key: "trackingNumber", label: "Tracking Number", type: "string", localHints: ["Tracking No", "Tracking Number", "AWB", "Waybill"], required: true },
    { key: "receiverName", label: "Receiver Name", type: "string", localHints: ["Receiver", "To", "Ship To", "Consignee"], description: `Name of the RECEIVER/consignee. ${NOT_SENDER}` },
    { key: "receiverPhone", label: "Receiver Phone", type: "string", localHints: ["Phone", "Contact No", "Mobile"], description: `Phone number of the RECEIVER/consignee. ${NOT_SENDER}` },
    { key: "receiverAddressLine1", label: "Address Line 1", type: "string", localHints: ["Address"], description: `Full street-level delivery address of the RECEIVER, including the barangay (there is no separate barangay field — fold it into this line, e.g. "123 Rizal St., Brgy. San Isidro"). ${NOT_SENDER}` },
    { key: "receiverCity", label: "City / Municipality", type: "string", localHints: ["City", "Municipality"], description: `City/municipality of the RECEIVER's delivery address. ${NOT_SENDER}` },
    { key: "receiverProvince", label: "Province", type: "string", localHints: ["Province"], description: `Province of the RECEIVER's delivery address. ${NOT_SENDER}` },
    { key: "shippingCost", label: "Shipping Fee (paid to courier)", type: "currency", localHints: ["Shipping Fee", "Freight", "COD Fee"] },
    { key: "weight", label: "Weight", type: "number", localHints: ["Weight", "Wt"] },
    { key: "goodsDescription", label: "Goods Description", type: "string", localHints: ["Goods", "Item Description", "Description"] },
    { key: "courierOrderNo", label: "Courier Order No.", type: "string", localHints: ["Order No", "Order Number"] },
  ],
};
