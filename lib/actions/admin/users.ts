"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/get-current-admin-user";

function assertPermission(user: { permissions: Set<string> }, permission: string) {
  if (!user.permissions.has(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export async function listRolesAdmin() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_users");

  const supabase = createAdminClient();
  const { data } = await supabase.from("roles").select("id, key, name, description").order("name");
  return data ?? [];
}

export async function listUsersAdmin() {
  const user = await requireAdminUser();
  assertPermission(user, "manage_users");

  const supabase = createAdminClient();
  const [{ data: authUsers }, { data: profiles }, { data: userRoles }] = await Promise.all([
    supabase.auth.admin.listUsers(),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("user_roles").select("user_id, roles(id, key, name)"),
  ]);

  const profileNames = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const rolesByUser = new Map<string, { id: string; key: string; name: string }[]>();
  for (const row of (userRoles ?? []) as unknown as {
    user_id: string;
    roles: { id: string; key: string; name: string } | null;
  }[]) {
    if (!row.roles) continue;
    const list = rolesByUser.get(row.user_id) ?? [];
    list.push(row.roles);
    rolesByUser.set(row.user_id, list);
  }

  return (authUsers?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "",
    fullName: profileNames.get(u.id) ?? null,
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    roles: rolesByUser.get(u.id) ?? [],
  }));
}

const inviteSchema = z.object({
  email: z.email(),
  fullName: z.string().trim().min(1).max(200),
  roleIds: z.array(z.string()),
});

export type UserFormState = { status: "idle" | "success" | "error"; error?: string };

export async function inviteAdminUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const user = await requireAdminUser();
  assertPermission(user, "manage_users");

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    roleIds: formData.getAll("roleIds"),
  });
  if (!parsed.success) return { status: "error", error: "Please check the form for errors." };

  const supabase = createAdminClient();
  const { data: invited, error } = await supabase.auth.admin.inviteUserByEmail(parsed.data.email);

  if (error || !invited.user) {
    console.error("inviteAdminUser failed", error?.message);
    return { status: "error", error: error?.message ?? "Failed to invite user." };
  }

  await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", invited.user.id);

  if (parsed.data.roleIds.length > 0) {
    await supabase.from("user_roles").insert(
      parsed.data.roleIds.map((roleId) => ({
        user_id: invited.user.id,
        role_id: roleId,
        assigned_by: user.id,
      }))
    );
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "user_invited",
    entity: "profiles",
    entity_id: invited.user.id,
    diff: { email: parsed.data.email, roleIds: parsed.data.roleIds },
  });

  return { status: "success" };
}

export async function updateUserRoles(userId: string, roleIds: string[]) {
  const user = await requireAdminUser();
  assertPermission(user, "manage_users");

  const supabase = createAdminClient();
  await supabase.from("user_roles").delete().eq("user_id", userId);

  if (roleIds.length > 0) {
    await supabase.from("user_roles").insert(
      roleIds.map((roleId) => ({
        user_id: userId,
        role_id: roleId,
        assigned_by: user.id,
      }))
    );
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "user_roles_updated",
    entity: "user_roles",
    entity_id: userId,
    diff: { roleIds },
  });

  return { ok: true as const };
}
