# Sinag Ukit BMS Architecture

## Philosophy

Sinag Ukit BMS follows a **Database-First Architecture**.

Business Rules ↓ Supabase Database ↓ PostgreSQL RPCs ↓ Server Actions ↓
React Components ↓ User Interface

Business logic should never exist only in the frontend.

## Technology Stack

### Frontend

-   Next.js 16 (App Router)
-   React 19
-   TypeScript
-   Tailwind CSS v4

### Backend

-   Supabase
-   PostgreSQL
-   RPC
-   RLS
-   Authentication
-   Storage

### Integrations

-   n8n
-   Loyverse
-   AI
-   WordPress
-   Future Mobile App

## UI Pattern

Server Component → Fetch Data → Client Component → Server Action

## Database Pattern

UI → Server Action → RPC → Database

**Never update inventory directly.**

## Authentication

Supabase Auth → middleware.ts → Role Check → RLS

## Roles

-   Admin
-   Manager
-   Encoder
-   Viewer (future)

## Inventory Flow

Five-bucket status model per `(variant, store)` on `inventory_levels`:
Available ⇄ Reserved ⇄ In Production ⇄ On Hold → Out, plus Incoming
(fed by Purchase Order receipt, drains to Available). Stock moves
between buckets only via `transfer_stock_status()`/`deduct_stock_out()`/
`adjust_incoming_qty()`/`adjust_stock()` — every transition also writes
an `inventory_movements` row (`status`, `quantity_before`,
`transfer_group_id` for paired transfers). Order confirmation reserves
(Available→Reserved); `start_production()` moves Reserved→In Production;
shipping/pickup is the only step that actually removes stock (In
Production/Available→Out via `deduct_stock_out()`); On Hold is reached
via order cancellation/hold mid-production and released back to
Available or scrapped from Items for Review. See `BUSINESS_RULES.md`
(Inventory/Orders/Production Orders/Shipments) and
`PROGRESS-INVENTORY.md` for the full build history (INV-1..16).

## Future

Finance • Analytics • Notifications • AI • Barcode • Reports
