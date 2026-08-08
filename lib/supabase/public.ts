import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { fetchWithTimeout } from "./fetch-with-timeout";

/**
 * Anon-key client with no cookie/session handling — safe to call from
 * inside `unstable_cache`, which cannot access `cookies()`/`headers()`.
 * Only use this for genuinely public, RLS-anon-readable reads (the same
 * data an anonymous visitor with no session would see via the normal
 * cookie-bound client anyway). Never use it for anything gated by a user's
 * own session or role.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: { fetch: fetchWithTimeout() },
    }
  );
}
