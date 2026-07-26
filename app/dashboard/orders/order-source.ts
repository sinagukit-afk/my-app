export type OrderSource =
  | "kkk"
  | "meta_ads"
  | "meta_organic"
  | "fb_marketplace"
  | "website"
  | "shopee"
  | "lazada"
  | "tiktok"
  | "others";

export const ORDER_SOURCE_OPTIONS: { value: OrderSource; label: string }[] = [
  { value: "kkk", label: "KKK" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "meta_organic", label: "Meta Organic" },
  { value: "fb_marketplace", label: "FB Marketplace" },
  { value: "website", label: "Website" },
  { value: "shopee", label: "Shopee" },
  { value: "lazada", label: "Lazada" },
  { value: "tiktok", label: "TikTok" },
  { value: "others", label: "Others" },
];

export function orderSourceLabel(value: string | null): string {
  return ORDER_SOURCE_OPTIONS.find((o) => o.value === value)?.label ?? "—";
}
