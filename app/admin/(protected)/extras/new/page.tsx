import type { Metadata } from "next";
import { createExtra } from "@/lib/actions/admin/extras";
import { ExtraForm } from "@/components/admin/ExtraForm";

export const metadata: Metadata = { title: "Add Extra" };

export default function NewExtraPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Add Extra</h1>
      <div className="max-w-xl rounded-xl border border-border bg-background p-6">
        <ExtraForm action={createExtra} submitLabel="Create Extra" />
      </div>
    </div>
  );
}
