"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type IncomingFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(formData: FormData, key: string) {
  const value = Number(readText(formData, key));
  return Number.isFinite(value) ? value : NaN;
}

export async function addIncomingItem(
  _state: IncomingFormState,
  formData: FormData
): Promise<IncomingFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "You must be signed in to add incoming items.",
    };
  }

  const itemId = readText(formData, "item_id");
  const variantId = readText(formData, "variant_id");
  const itemName = readText(formData, "item_name");
  const quantity = readNumber(formData, "quantity");
  const unitPrice = readNumber(formData, "unit_price");
  const totalPrice = readNumber(formData, "total_price");
  const discountAmount = readNumber(formData, "discount_amount");
  const dateReceived = readText(formData, "date_received");
  const orderId = readText(formData, "order_id");
  const shippingFee = readNumber(formData, "shipping_fee");
  const supplier = readText(formData, "supplier");
  const source = readText(formData, "source") || "online";

  if (!itemId || !variantId || !itemName) {
    return { status: "error", message: "Choose an item from the list." };
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { status: "error", message: "Quantity must be greater than zero." };
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return { status: "error", message: "Price must be zero or higher." };
  }

  if (!Number.isFinite(totalPrice) || totalPrice < 0) {
    return { status: "error", message: "Total price must be zero or higher." };
  }

  if (!dateReceived) {
    return { status: "error", message: "Date received is required." };
  }

  const safeShippingFee =
    Number.isFinite(shippingFee) && shippingFee >= 0 ? shippingFee : 0;
  const computedDiscount = quantity * unitPrice - totalPrice;
  const safeDiscountAmount = Number.isFinite(discountAmount)
    ? discountAmount
    : computedDiscount;

  const { error } = await supabase.from("incoming_items").insert({
    item_id: itemId,
    variant_id: variantId,
    item_name_snapshot: itemName,
    quantity,
    unit_price: unitPrice,
    total_price: totalPrice,
    discount_amount: safeDiscountAmount,
    date_received: dateReceived,
    order_id: orderId || null,
    shipping_fee: safeShippingFee,
    supplier: supplier || null,
    source,
    received_by: user.id,
    received_by_email: user.email ?? null,
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  revalidatePath("/dashboard/incoming");

  return {
    status: "success",
    message: "Incoming item was saved.",
  };
}
