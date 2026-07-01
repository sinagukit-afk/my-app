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

Incoming Inventory → Inventory Levels → Inventory Movements → Sales /
Adjustments

## Future

Finance • Analytics • Notifications • AI • Barcode • Reports
