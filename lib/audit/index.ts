// TODO: Audit log integration
//
// Wiring plan:
//   1. Create a `audit_logs` table in Supabase (add a migration under supabase/):
//
//        create table audit_logs (
//          id          uuid primary key default gen_random_uuid(),
//          created_at  timestamptz not null default now(),
//          user_id     uuid references auth.users(id),
//          action      text not null,          -- e.g. 'inventory.update'
//          entity_type text not null,          -- e.g. 'product'
//          entity_id   text,                   -- the record that was changed
//          before      jsonb,
//          after       jsonb
//        );
//
//        alter table audit_logs enable row level security;
//        -- Only admins can read; no user can update/delete.
//
//   2. Add a logAuditEvent() server-side helper here:
//
//        import { createServerClient } from '@/lib/supabase/server';
//
//        export async function logAuditEvent(params: {
//          action: string;
//          entityType: string;
//          entityId?: string;
//          before?: unknown;
//          after?: unknown;
//        }): Promise<void> {
//          const supabase = await createServerClient();
//          const { data: { user } } = await supabase.auth.getUser();
//          await supabase.from('audit_logs').insert({
//            user_id: user?.id,
//            ...params,
//            entity_type: params.entityType,
//            entity_id: params.entityId,
//          });
//        }
//
//   3. Call logAuditEvent() inside server actions whenever data is mutated
//      (e.g. after addIncomingItem, after updating a product, after role changes).
//   4. The Administration → Activity Logs page (app/dashboard/administration/activity-logs/)
//      is already stubbed — wire it to query this table.
//
// No implementation goes here; this file is the registry comment only.

export {};
