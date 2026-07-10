# Sinag Ukit BMS — Accounting Module: Event-Driven Auto-Posting

## Rewrite of ACCT-7 ("Auto-posting from `confirm_order()` / PO receiving")

> **Design-only document.** No migrations, RPCs, or UI have been built from
> this doc yet — it's the output of a requirements review with Sinag
> (2026-07-10), grounded against the live schema and `DECISIONS.md`. Exact
> DDL, RPC bodies, and account-number placement will be finalized when a
> build session actually starts ACCT-7.1.

## Why ACCT-7 needed a rewrite, not just a resume

The original `PROGRESS-ACCOUNTING.md` scoped ACCT-7 as "waiting on core BMS
order/PO flow to stabilize," with the implied hook point being
`confirm_order()`. That function was retired in **D027** (2026-07-06, Order
Module Improvement) — the order lifecycle today is an 8-status state machine
(`confirmed → in_production → partially_completed → production_completed →
ready_for_shipping → shipped → delivered`, plus `on_hold`/`cancelled`)
spread across `create_order`, `adjust_order_items`, `start_production`,
production-completion RPCs, `mark_shipment_shipped`/`mark_shipment_picked_up`,
`close_order_payment`, and `cancel_order`. The stabilization ACCT-7 was
waiting for has happened (Orders/Production/Shipping/Payment are all 🟩 in
`MODULE_STATUS.md`) — but the hook point itself moved. This doc re-scopes
ACCT-7 against the real RPC graph and adds the architecture Sinag asked for
on top: an event log instead of direct-posting, and a Draft → Review →
Approve workflow instead of one-shot posting.

This also incorporates a separate proposal Sinag brought in (an
"Operations emit events → Accounting never reads live operational tables"
architecture) — reviewed against this app's actual state and simplified
down to what fits its scale. See the conversation log for the full
point-by-point review; this doc carries only the resulting decisions.

---

## Confirmed design decisions

1. **Chart of Accounts gets a real edit UI** (admin-only) — today COA only
   exists via migration/direct SQL, no CRUD page. Part of this kickoff.
2. **Revenue recognizes when payment is closed** (`close_order_payment()`),
   not at order confirmation. No Accounts Receivable usage in the new flow
   — `1100 Accounts receivable` stays in the Chart of Accounts unused by
   this feature (legacy from the original seed list, not removed).
3. **Partial-Paid close (write-off case): full order value recognized as
   revenue**, with the uncollected remainder posted to a new write-off
   expense account — not a reduction of revenue.
4. **Overpayment tip → its own Tip Income account**, not folded into Sales
   Revenue.
5. **COGS posts separately from revenue, at actual stock-out** (shipment
   shipped/picked-up), not at payment close. The two can land in different
   accounting periods for the same order — that's expected, not a bug.
6. **Purchasing (PO Received / Manual Incoming) assumes already paid** —
   no Accounts Payable for ordinary purchases.
7. **Credit card purchases use Option B**: treated as a short-term
   liability (Credit Card Payable), not "paid in full at receipt." Requires
   Purchasing to capture payment method at receiving (new field — see
   below), since no such field exists today.
8. **Manual Incoming is always a real purchase** (has a real cost) — same
   posting treatment as PO Received, no separate "count correction, no
   cost" branch needed for that specific screen.
9. **Review + Approve = admin and manager** (matches the existing
   `post_journal_entry()` permission tier — no new role tier needed).
10. **Workflow: Snapshot (auto) → Draft Journal (auto) → Review (admin/
    manager, can edit) → Approve & Post (locks it in).** Two human
    checkpoints collapsed from the original proposal's four.
11. **Corrections use reversal, never edit-or-delete.** Today's only
    precedent (a stray entry fixed via raw SQL `DELETE` in the ACCT-4
    session) is exactly what this is meant to replace.

---

## Event catalog (final)

| # | Business event | Trigger (existing RPC) | Draft entry |
|---|---|---|---|
| 1 | Sale recognized | `close_order_payment()` | Paid/Overpaid: `Dr Cash/Bank [order total] / Cr Sales Revenue [order total]`; Overpaid adds `Dr Cash [tip] / Cr Tip Income [tip]`; Partially Paid: `Dr Cash/Bank [amount collected] + Dr Write-off Expense [uncollected] / Cr Sales Revenue [full order total]` |
| 2 | Cost of goods sold | `mark_shipment_shipped()` / `mark_shipment_picked_up()` (both call `deduct_stock_out()`) | `Dr Material Expense - <product line> / Cr Inventory - <material category>`, at item cost × qty. Reuses the existing per-product Material Expense accounts (5001–5021) rather than one generic COGS account. |
| 3 | Purchase received | `receive_purchase_order()` | Ordinary payment: `Dr Inventory - <material category> / Cr Cash/Bank`. Credit card: `Dr Inventory - <material category> / Cr Credit Card Payable` |
| 4 | Manual incoming | `apply_incoming_item_inventory_movement()` | Same as #3 (always a real purchase per decision 8) |
| 5 | Inventory adjustment (gain) | Item Adjustment screen (`adjust_stock()` — exact hook to reconfirm at build time) | `Dr Inventory - <category> / Cr Inventory Adjustment Gain` |
| 6 | Inventory adjustment / scrap (loss) | Item Adjustment screen or Items for Review → Release to Scrap (RPC to reconfirm at build time — currently generic bucket-transfer functions, not a dedicated "scrap" RPC) | `Dr Inventory Shrinkage/Scrap Expense / Cr Inventory - <category>` |
| 7 | Credit card installment payment | New (doesn't exist yet — see below) | `Dr Credit Card Payable [installment] + Dr Credit Card Interest Expense [any finance charge] / Cr Cash/Bank` |

Events #2, #3, #5, #6 need an **item/category → account mapping** (which
`items`/`item_categories` row maps to which `Inventory - X` / `Material
Expense - X` pair) — the existing 95-account seed has 10 material
categories (Wood for Ref Magnet, Coaster, Keychain Metal, Keychain Leather,
Paddle Hair Brush, Magnet, Kraft Paper, Plastic, Phone Stand, Bottle
Opener). This needs the same kind of confirm-with-Sinag pass ACCT-3 did for
Rent/Transportation — not something to guess account-by-account.

**Gap found while building this mapping:** `4020`/`5020` ("Sales Revenue -
Frame" / "Material Expense - Frame") have no matching `Inventory - Frame`
account in the `1200`–`1209` range — every other product line has one. See
new account `1210` below.

---

## New Chart of Accounts entries needed

Proposed additions to the 95-account re-seed — numbers are placeholders,
confirm with Sinag before seeding (same as the original ACCT-1 confirm
step):

| # | Name | Category | Why |
|---|---|---|---|
| 1210 | Inventory - Frame | asset | Fills the gap next to existing `4020`/`5020` Frame revenue/expense pair — every other product line already has one |
| 2020 | Credit Card Payable | liability | Decision 7 — short-term liability for card-funded purchases |
| 4041 | Tip Income | revenue | Decision 4 |
| 4042 | Inventory Adjustment Gain | revenue | Event #5 |
| 6090 | Bad Debts / Write-off Expense | expense | Decision 3 |
| 6091 | Inventory Shrinkage / Scrap Expense | expense | Event #6 |
| 6092 | Credit Card Interest / Finance Charges | expense | Event #7 |

No new **Cost of Goods Sold** account — the existing per-product `Material
Expense - X` accounts (5001–5021) already serve that purpose at finer
granularity than a single COGS line would.

---

## Prerequisite: Purchasing has no payment-method field

`purchase_orders` has no `payment_type_id` at all today (unlike `orders`,
which does). To support decision 7 (credit card vs. ordinary payment), a
receiving-time capture is needed:

- A payment-method field on the receiving flow (mirrors `orders.
  payment_type_id`, reusing the existing `payment_types` table).
- A way to flag "paid via credit card" specifically (vs. cash/bank/other),
  since that's what decides whether event #3 credits Cash/Bank or Credit
  Card Payable.
- No installment *schedule* table planned — each installment payment is
  logged as its own event (#7) when it happens, not pre-scheduled. Keeps
  this from turning into a small amortization-tracking feature nobody
  asked for.

This is Purchasing-module scope, not Accounting-module — it's the
"linking of purchasing to the account" work Sinag asked to fold into this
kickoff.

---

## Proposed schema additions (design-level, not final DDL)

- **`business_events`** — the event log. One row per financially-relevant
  operational action: `event_type`, `source_table`, `source_id`,
  `occurred_at`, `payload` (jsonb — the frozen snapshot of whatever numbers
  the rule engine needs, captured at event time so accounting never
  re-reads the live operational tables later). Written by the triggering
  RPC itself, inside its existing transaction, per decisions in the
  original architecture review — the merge of "Business Event" and
  "Accounting Snapshot" into one object rather than two, since this app's
  scale doesn't need them kept separate.
- **`journal_entry_drafts` / `journal_entry_draft_lines`** — a mutable
  staging area, structurally mirroring `journal_entries`/
  `journal_entry_lines` but editable during Review. Keeps the real ledger
  tables' existing "no UPDATE/DELETE policy" immutability guarantee intact
  — nothing enters `journal_entries` until Approve & Post. A posted draft
  stays linked to the final entry it became (for audit — so it's visible
  later whether admin edited the auto-generated numbers before approving).
- **`reverse_journal_entry(p_entry_id, p_reason)`** — new RPC. Posts a
  mirror entry (debits/credits swapped) linked back via `source_type =
  'reversal'` / `source_id = p_entry_id`. This is what replaces the
  raw-SQL-delete precedent from ACCT-4.
- **Category/item → account mapping table** — resolves which `Inventory -
  X` / `Material Expense - X` pair a given item's sale/purchase/adjustment
  posts to. Same shape as ACCT-3's income/expense category mapping, just
  for this new set of events.
- **Purchasing payment-method fields** (see prerequisite above).

---

## Proposed phase breakdown

Replaces the single "ACCT-7" line in `PROGRESS-ACCOUNTING.md`'s status
table with sub-phases. ACCT-8 (BIR calculator) is untouched by this
rewrite.

| Phase | Description | Depends on |
|---|---|---|
| ACCT-7.1 | ~~Re-seed original 95 + 7 new accounts~~ **done 2026-07-10** (103 accounts live). Chart of Accounts edit UI (admin-only) still **not built** — accounts only editable via migration/SQL for now | Sinag confirms account numbers/names — done |
| ACCT-7.2 | Purchasing payment-method capture at receiving (new field + credit-card flag) | — |
| ACCT-7.3 | ~~Mapping table + page~~ **built 2026-07-10** (`item_accounting_mappings` + `/dashboard/accounting/product-mapping`). Sinag's confirmation pass (filling in all 62 items) still **not done** | ACCT-7.1 (reseed) — done |
| ACCT-7.4 | `business_events` table + wire the 6 existing trigger RPCs to write into it | ACCT-7.2, ACCT-7.3 |
| ACCT-7.5 | `journal_entry_drafts`/`journal_entry_draft_lines` + rule engine that turns unprocessed events into drafts | ACCT-7.4 |
| ACCT-7.6 | Review & Approve/Post UI (admin/manager) + the RPC that promotes a draft into `post_journal_entry()` | ACCT-7.5 |
| ACCT-7.7 | `reverse_journal_entry()` RPC + UI action on the journal detail page | ACCT-2 (already live) |
| ACCT-7.8 | Credit Card Payable event/RPC (#7 in the catalog) — logs an installment payment against the liability | ACCT-7.1, ACCT-7.2 |

---

## Still open before build starts

- Exact account numbers above are placeholders — confirm before ACCT-7.1
  seeds them.
- The item/category → account mapping (ACCT-7.3) needs Sinag's input
  category-by-category, same as Rent/Transportation in ACCT-3 — can't be
  guessed correctly from the outside.
- Exact RPC hook point for scrap release (event #6) needs confirming
  against the live Items for Review code at build time — not fully
  pinned down in this doc.
