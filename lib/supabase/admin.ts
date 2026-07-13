import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { fetchWithTimeout } from "./fetch-with-timeout";

/**
 * Service-role client. Bypasses RLS entirely — only import this from
 * Server Actions and route handlers, never from anything that runs
 * client-side or that echoes untrusted input straight into a query.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: { fetch: fetchWithTimeout() },
    }
  );
}
