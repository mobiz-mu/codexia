import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CurrentAdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  roles: string[];
  permissions: Set<string>;
};

// React.cache() dedupes repeated calls within a single request — the admin
// layout calls this once for the shell, and nearly every Server Action on
// the same page load calls requireAdminUser() again; without caching that's
// a full auth + 2 DB round-trips duplicated on every admin page render.
export const getCurrentAdminUser = cache(async (): Promise<CurrentAdminUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // user_roles/role_permissions RLS requires manage_users to read directly,
  // so a non-admin staff member can't see their own row via the session
  // client. The admin client here only ever looks up rows scoped to this
  // already-authenticated user's own id, never arbitrary user input.
  const admin = createAdminClient();

  const [{ data: profile }, { data: userRoles }] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    admin
      .from("user_roles")
      .select("roles(key, role_permissions(permissions(key)))")
      .eq("user_id", user.id),
  ]);

  type RoleRow = {
    roles: {
      key: string;
      role_permissions: { permissions: { key: string } }[];
    } | null;
  };

  const rows = (userRoles ?? []) as unknown as RoleRow[];
  const roles = rows.map((r) => r.roles?.key).filter((k): k is string => Boolean(k));
  const permissions = new Set(
    rows.flatMap((r) => r.roles?.role_permissions.map((rp) => rp.permissions.key) ?? [])
  );

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    roles,
    permissions,
  };
});

export async function requireAdminUser(): Promise<CurrentAdminUser> {
  const user = await getCurrentAdminUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
