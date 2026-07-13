"use client";

import { useActionState } from "react";
import { inviteAdminUser, type UserFormState } from "@/lib/actions/admin/users";

export function UserInviteForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(inviteAdminUser, { status: "idle" } as UserFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Full Name</label>
          <input type="text" name="fullName" required className="rounded-lg border border-border px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Email</label>
          <input type="email" name="email" required className="rounded-lg border border-border px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Roles</label>
        <div className="flex flex-wrap gap-3">
          {roles.map((role) => (
            <label key={role.id} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="roleIds" value={role.id} />
              {role.name}
            </label>
          ))}
        </div>
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.status === "success" && <p className="text-sm text-green-700">Invitation sent.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Sending..." : "Send Invite"}
      </button>
    </form>
  );
}
