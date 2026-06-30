"use client";

import { useActionState, useMemo, useState } from "react";
import { addIncomingItem, type IncomingFormState } from "./actions";

type ItemOption = {
  id: string;
  variantId: string;
  name: string;
  sku: string | null;
  cost: number | null;
};

const initialState: IncomingFormState = {
  status: "idle",
  message: "",
};

export function IncomingItemForm({
  items,
  userEmail,
}: {
  items: ItemOption[];
  userEmail: string;
}) {
  const [state, formAction, pending] = useActionState(
    addIncomingItem,
    initialState
  );
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ItemOption | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [totalPrice, setTotalPrice] = useState("");

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return items.slice(0, 12);
    }

    return items
      .filter((item) => item.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 12);
  }, [items, query]);

  const subtotal = Number(quantity || 0) * Number(unitPrice || 0);
  const discount = subtotal - Number(totalPrice || 0);

  function applyItem(item: ItemOption) {
    const nextPrice = item.cost === null ? "" : String(item.cost);

    setSelectedItem(item);
    setQuery(item.name);
    setUnitPrice(nextPrice);
    setTotalPrice(
      nextPrice ? String(Number(quantity || 0) * Number(nextPrice)) : ""
    );
  }

  function updateQuantity(value: string) {
    setQuantity(value);
    setTotalPrice(String(Number(value || 0) * Number(unitPrice || 0)));
  }

  function updateUnitPrice(value: string) {
    setUnitPrice(value);
    setTotalPrice(String(Number(quantity || 0) * Number(value || 0)));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="item_id" value={selectedItem?.id ?? ""} />
      <input
        type="hidden"
        name="variant_id"
        value={selectedItem?.variantId ?? ""}
      />
      <input type="hidden" name="item_name" value={selectedItem?.name ?? ""} />
      <input
        type="hidden"
        name="discount_amount"
        value={Number.isFinite(discount) ? discount.toFixed(2) : "0.00"}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <label
            htmlFor="item-search"
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            Item name
          </label>
          <div className="relative">
            <input
              id="item-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedItem(null);
                setUnitPrice("");
                setTotalPrice("");
              }}
              placeholder="Search Inv items"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              required
            />
            {query && !selectedItem ? (
              <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-stone-200 bg-white shadow-lg">
                {filteredItems.length ? (
                  filteredItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => applyItem(item)}
                      className="block w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="ml-2 text-xs text-stone-500">
                        {item.sku ? `${item.sku} / ` : ""}
                        Cost: {item.cost === null ? "not set" : item.cost}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-stone-500">
                    No matching items.
                  </p>
                )}
              </div>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Only items starting with Inv are shown.
          </p>
        </div>

        <div>
          <label
            htmlFor="quantity"
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            Quantity
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min="0.001"
            step="0.001"
            value={quantity}
            onChange={(event) => updateQuantity(event.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            required
          />
        </div>

        <div>
          <label
            htmlFor="unit_price"
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            Price
          </label>
          <input
            id="unit_price"
            name="unit_price"
            type="number"
            min="0"
            step="0.01"
            value={unitPrice}
            onChange={(event) => updateUnitPrice(event.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            required
          />
          <p className="mt-1 text-xs text-stone-500">
            Auto-filled from item variant cost. You can still adjust it.
          </p>
        </div>

        <div>
          <label
            htmlFor="total_price"
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            Total price
          </label>
          <input
            id="total_price"
            name="total_price"
            type="number"
            min="0"
            step="0.01"
            value={totalPrice}
            onChange={(event) => setTotalPrice(event.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">
            Discount
          </label>
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-900">
            PHP{" "}
            {Number.isFinite(discount)
              ? discount.toLocaleString("en-PH", {
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 2,
                })
              : "0.00"}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Computed as quantity x price minus total price.
          </p>
        </div>

        <div>
          <label
            htmlFor="shipping_fee"
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            Shipping fee
          </label>
          <input
            id="shipping_fee"
            name="shipping_fee"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            required
          />
        </div>

        <div>
          <label
            htmlFor="date_received"
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            Date received
          </label>
          <input
            id="date_received"
            name="date_received"
            type="date"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            required
          />
        </div>

        <div>
          <label
            htmlFor="order_id"
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            Order ID
          </label>
          <input
            id="order_id"
            name="order_id"
            type="text"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
          />
        </div>

        <div>
          <label
            htmlFor="supplier"
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            Supplier
          </label>
          <input
            id="supplier"
            name="supplier"
            type="text"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
          />
        </div>

        <div>
          <label
            htmlFor="source"
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            Source
          </label>
          <select
            id="source"
            name="source"
            defaultValue="online"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            required
          >
            <option value="online">Online</option>
            <option value="supplier">Supplier</option>
            <option value="walk-in">Walk-in</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">
            Encoded by
          </label>
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
            {userEmail}
          </div>
        </div>
      </div>

      {state.message ? (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            state.status === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !selectedItem}
        className="rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        {pending ? "Saving..." : "Add incoming item"}
      </button>
    </form>
  );
}
