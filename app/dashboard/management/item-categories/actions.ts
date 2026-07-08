"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { success: true } | { success: false; error: string };

export async function setCategoryType(
  id: string,
  categoryType: "product" | "packaging"
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ category_type: categoryType })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/management/item-categories");
  return { success: true };
}
