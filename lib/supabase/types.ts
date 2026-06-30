// TODO: Generated Supabase database types
//
// Wiring plan:
//   1. Once the production schema is stable, run:
//        npx supabase gen types typescript --project-id <your-project-id> \
//          --schema public > lib/supabase/types.ts
//      (or via the Supabase MCP tool: generate_typescript_types)
//   2. Replace the export below with the generated `Database` type.
//   3. Pass it as a generic to the Supabase clients:
//        createBrowserClient<Database>(...)
//        createServerClient<Database>(...)
//   4. Re-run after every schema migration so TypeScript catches query mismatches.
//
// No credentials or project IDs belong in this file.

export type Database = Record<string, never>; // replace with generated type
