export type PlatformSource = "shopee" | "lazada" | "fb_page" | "fb_marketplace" | "physical_store" | "others";

export const PLATFORM_SOURCE_OPTIONS: { value: PlatformSource; label: string }[] = [
  { value: "shopee", label: "Shopee" },
  { value: "lazada", label: "Lazada" },
  { value: "fb_page", label: "FB Page" },
  { value: "fb_marketplace", label: "FB Marketplace" },
  { value: "physical_store", label: "Physical Store" },
  { value: "others", label: "Others" },
];

export function platformSourceLabel(value: string | null): string {
  return PLATFORM_SOURCE_OPTIONS.find((o) => o.value === value)?.label ?? "—";
}
