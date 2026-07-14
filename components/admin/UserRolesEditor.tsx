"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUserRoles } from "@/lib/actions/admin/users";

export function UserRolesEditor({
  userId,
  allRoles,
  assignedRoleIds,
}: {
  userId: string;
  allRoles: { id: string; name: string }[];
  assignedRoleIds: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedRoleIds));
  const [pending, startTransition] = useTransition();

  function toggle(roleId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      await updateUserRoles(userId, [...selected]);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {allRoles.map((role) => (
          <label
            key={role.id}
            className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-ink transition-colors hover:border-primary"
          >
            <input
              type="checkbox"
              checked={selected.has(role.id)}
              onChange={() => toggle(role.id)}
              className="h-3.5 w-3.5 accent-primary"
            />
            {role.name}
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="self-start rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save Roles"}
      </button>
    </div>
  );
}
