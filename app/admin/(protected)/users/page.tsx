import type { Metadata } from "next";
import { listUsersAdmin, listRolesAdmin } from "@/lib/actions/admin/users";
import { UserInviteForm } from "@/components/admin/UserInviteForm";
import { UserRolesEditor } from "@/components/admin/UserRolesEditor";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const [users, roles] = await Promise.all([listUsersAdmin(), listRolesAdmin()]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-ink">Users</h1>

      <section className="rounded-xl border border-border bg-background p-6">
        <h2 className="mb-4 font-semibold text-ink">Invite Staff Member</h2>
        <UserInviteForm roles={roles} />
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Last Sign In</th>
              <th className="px-4 py-2">Roles</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border align-top last:border-0">
                <td className="px-4 py-3">{u.fullName ?? "—"}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString("en-GB") : "Never"}
                </td>
                <td className="px-4 py-3">
                  <UserRolesEditor
                    userId={u.id}
                    allRoles={roles}
                    assignedRoleIds={u.roles.map((r) => r.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
