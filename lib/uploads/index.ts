// TODO: File upload integration
//
// Wiring plan:
//   1. Create a Supabase Storage bucket (e.g. "uploads") via the Supabase dashboard or a migration.
//   2. Set bucket RLS policies (authenticated users can insert their own files).
//   3. Add an upload helper here using the Supabase client:
//
//        import { createBrowserClient } from '@/lib/supabase/client';
//
//        export async function uploadFile(
//          bucket: string,
//          path: string,
//          file: File,
//        ): Promise<string> {
//          const supabase = createBrowserClient();
//          const { data, error } = await supabase.storage.from(bucket).upload(path, file);
//          if (error) throw error;
//          return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
//        }
//
//   4. Drop a <FileUploader /> component (components/ui/ or components/business/)
//      that calls uploadFile() and feeds the returned URL into the relevant form.
//   5. For large files consider chunked upload or direct-to-storage presigned URLs.
//
// No bucket names or storage URLs belong in this file.

export {};
