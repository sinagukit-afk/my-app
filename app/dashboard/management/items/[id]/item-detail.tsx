"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { formatCurrency, formatQty } from "@/lib/utils/format";
import { archiveItem } from "../actions";
import { STATUS_BADGE, STATUS_LABEL, SYNC_BADGE, SYNC_LABEL, type ItemRow } from "../items-table";

export type DetailComponent = {
  name: string;
  sku: string | null;
  quantity: number;
  cost: number | null;
};

export type DetailVariant = {
  id: string;
  sku: string;
  barcode: string | null;
  options: string | null;
  cost: number | null;
  default_price: number | null;
  pricing_type: "FIXED" | "VARIABLE";
  default_purchase_cost: number | null;
  in_stock: number | null;
  low_stock_threshold: number | null;
  components: DetailComponent[];
};

export type ItemDetailData = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  item_type: "simple" | "composite";
  sold_by: "each" | "weight";
  track_stock: boolean;
  supplier: string | null;
  status: ItemRow["status"];
  sync_status: string;
  sync_error: string | null;
};

type Props = {
  item: ItemDetailData;
  variants: DetailVariant[];
  modifiers: string[];
  canWrite: boolean;
};

function componentTotal(components: DetailComponent[]): number {
  return components.reduce((sum, c) => sum + c.quantity * (c.cost ?? 0), 0);
}

export function ItemDetail({ item, variants, modifiers, canWrite }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  function handleArchive() {
    setArchiveError(null);
    startTransition(async () => {
      const res = await archiveItem(item.id);
      if (res.success) {
        setArchiveOpen(false);
        router.refresh();
      } else {
        setArchiveError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.name}
        description={item.category ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/management/items">
              <Button variant="secondary">Back to Items</Button>
            </Link>
            {canWrite && item.status !== "archived" && (
              <Link href={`/dashboard/management/items/${item.id}/edit`}>
                <Button variant="secondary">Edit Item</Button>
              </Link>
            )}
            {canWrite && item.status !== "archived" && (
              <Button
                variant="danger"
                disabled={isPending}
                onClick={() => {
                  setArchiveError(null);
                  setArchiveOpen(true);
                }}
              >
                Archive
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_BADGE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
        <Badge variant={item.item_type === "composite" ? "default" : "neutral"}>
          {item.item_type === "composite" ? "Composite" : "Simple"}
        </Badge>
        <div title={item.sync_error ?? undefined}>
          <Badge variant={SYNC_BADGE[item.sync_status] ?? "neutral"}>
            {SYNC_LABEL[item.sync_status] ?? item.sync_status}
          </Badge>
        </div>
      </div>
      {item.sync_status === "failed" && item.sync_error && (
        <p className="text-sm text-(--color-danger)">Sync error: {item.sync_error}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-(--color-text-muted)">Category</p>
            <p className="text-sm text-(--color-text)">{item.category ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-(--color-text-muted)">Sold By</p>
            <p className="text-sm text-(--color-text)">{item.sold_by === "weight" ? "Weight" : "Each"}</p>
          </div>
          <div>
            <p className="text-xs text-(--color-text-muted)">Track Stock</p>
            <p className="text-sm text-(--color-text)">{item.track_stock ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-xs text-(--color-text-muted)">Primary Supplier</p>
            <p className="text-sm text-(--color-text)">{item.supplier ?? "—"}</p>
          </div>
          {item.description && (
            <div className="sm:col-span-2">
              <p className="text-xs text-(--color-text-muted)">Description</p>
              <p className="text-sm text-(--color-text)">{item.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Variants</CardTitle>
          <CardDescription>SKU, pricing, cost{item.track_stock ? ", and stock" : ""} per variant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className={`hidden gap-2 text-xs font-medium text-(--color-text-muted) lg:grid ${
              item.track_stock ? "lg:grid-cols-[2fr_1fr_1fr_1fr]" : "lg:grid-cols-[2fr_1fr_1fr]"
            }`}
          >
            <span>Variant</span>
            <span className="text-right">Price</span>
            <span className="text-right">Cost</span>
            {item.track_stock && <span className="text-right">Stock</span>}
          </div>
          {variants.map((v) => (
            <div key={v.id} className="border-b border-(--color-border) pb-3 text-sm last:border-0">
              <div
                className={`hidden items-center gap-2 lg:grid ${
                  item.track_stock ? "lg:grid-cols-[2fr_1fr_1fr_1fr]" : "lg:grid-cols-[2fr_1fr_1fr]"
                }`}
              >
                <div>
                  <span className="text-(--color-text)">{v.sku}</span>
                  {v.options && <p className="text-xs text-(--color-text-muted)">{v.options}</p>}
                </div>
                <span className="text-right text-(--color-text)">
                  {v.pricing_type === "FIXED" && v.default_price !== null
                    ? formatCurrency(v.default_price)
                    : "Variable"}
                </span>
                <span className="text-right text-(--color-text)">
                  {v.cost !== null ? formatCurrency(v.cost) : "—"}
                </span>
                {item.track_stock && (
                  <span className="text-right text-(--color-text)">
                    {v.in_stock !== null ? formatQty(v.in_stock) : "—"}
                    {v.low_stock_threshold !== null && (
                      <p className="text-xs text-(--color-text-muted)">Min {formatQty(v.low_stock_threshold)}</p>
                    )}
                    <Link
                      href={`/dashboard/inventory/monitoring/${encodeURIComponent(v.sku)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block text-xs text-(--color-primary) hover:underline"
                    >
                      View in Monitoring →
                    </Link>
                  </span>
                )}
              </div>

              <div className="space-y-1 lg:hidden">
                <div>
                  <span className="text-(--color-text)">{v.sku}</span>
                  {v.options && <p className="text-xs text-(--color-text-muted)">{v.options}</p>}
                </div>
                <div className="flex justify-between">
                  <span className="text-(--color-text-muted)">Price</span>
                  <span className="text-(--color-text)">
                    {v.pricing_type === "FIXED" && v.default_price !== null
                      ? formatCurrency(v.default_price)
                      : "Variable"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--color-text-muted)">Cost</span>
                  <span className="text-(--color-text)">{v.cost !== null ? formatCurrency(v.cost) : "—"}</span>
                </div>
                {item.track_stock && (
                  <div className="flex items-center justify-between">
                    <span className="text-(--color-text-muted)">Stock</span>
                    <span className="text-right text-(--color-text)">
                      {v.in_stock !== null ? formatQty(v.in_stock) : "—"}
                      {v.low_stock_threshold !== null && ` (min ${formatQty(v.low_stock_threshold)})`}
                      <Link
                        href={`/dashboard/inventory/monitoring/${encodeURIComponent(v.sku)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block text-xs text-(--color-primary) hover:underline"
                      >
                        View in Monitoring →
                      </Link>
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {item.item_type === "composite" && (
        <Card>
          <CardHeader>
            <CardTitle>Components</CardTitle>
            <CardDescription>What each variant is built from, and its computed cost.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {variants.map((v) => (
              <div key={v.id} className="space-y-2">
                <p className="text-sm font-medium text-(--color-text)">{v.sku}</p>
                {v.components.length === 0 ? (
                  <p className="text-sm text-(--color-text-subtle)">No components recorded.</p>
                ) : (
                  <div className="space-y-1">
                    {v.components.map((c, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-(--color-text)">
                          {c.name}
                          {c.sku ? ` (${c.sku})` : ""} × {formatQty(c.quantity)}
                        </span>
                        <span className="text-(--color-text-muted)">
                          {c.cost !== null ? formatCurrency(c.cost * c.quantity) : "—"}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-(--color-border) pt-1 text-sm font-medium">
                      <span className="text-(--color-text)">Total cost</span>
                      <span className="text-(--color-text)">{formatCurrency(componentTotal(v.components))}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {modifiers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Modifiers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {modifiers.map((m) => (
              <Badge key={m} variant="neutral">
                {m}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={archiveOpen}
        onOpenChange={(next) => {
          setArchiveOpen(next);
          if (!next) setArchiveError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Item</DialogTitle>
            <DialogDescription>
              Archive &quot;{item.name}&quot;? It will be hidden from the active catalog and no longer sync to
              Loyverse.
            </DialogDescription>
          </DialogHeader>
          {archiveError && <p className="text-sm text-(--color-danger)">{archiveError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="danger" onClick={handleArchive} disabled={isPending}>
              {isPending ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
