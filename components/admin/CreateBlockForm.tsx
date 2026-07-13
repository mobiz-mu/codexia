"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBlock, type BlockFormState } from "@/lib/actions/admin/availability";

export function CreateBlockForm({ vehicles }: { vehicles: { id: string; name: string }[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createBlock, { status: "idle" } as BlockFormState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-background p-4"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">Vehicle</label>
        <select name="vehicleId" required className="rounded-lg border border-border px-3 py-2 text-sm">
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">Type</label>
        <select name="type" className="rounded-lg border border-border px-3 py-2 text-sm">
          <option value="maintenance">Maintenance</option>
          <option value="internal">Internal</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">Start</label>
        <input type="datetime-local" name="startAt" required className="rounded-lg border border-border px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">End</label>
        <input type="datetime-local" name="endAt" required className="rounded-lg border border-border px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">Note</label>
        <input type="text" name="note" className="rounded-lg border border-border px-3 py-2 text-sm" />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add Block"}
      </button>
      {state.status === "error" && (
        <p className="w-full text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
