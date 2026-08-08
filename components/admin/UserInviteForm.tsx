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
          <input
            type="text"
            name="fullName"
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink">Email</label>
          <input
            type="email"
            name="email"
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink">Roles</label>
        <div className="flex flex-wrap gap-3">
          {roles.map((role) => (
            <label
              key={role.id}
              className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-sm text-ink transition-colors hover:border-primary"
            >
              <input type="checkbox" name="roleIds" value={role.id} className="h-3.5 w-3.5 accent-primary" />
              {role.name}
            </label>
          ))}
        </div>
      </div>

      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="assertive">
          {state.error}
        </p>
      )}
      {state.status === "success" && (
        <p className="rounded-lg bg-action-tint px-3 py-2 text-sm text-action-dark" role="status">
          Invitation sent.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-action px-6 py-2.5 text-sm font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? "Sending..." : "Send Invite"}
      </button>
    </form>
  );
}
