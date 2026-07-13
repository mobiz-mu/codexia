import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExtraAdmin, updateExtra } from "@/lib/actions/admin/extras";
import { ExtraForm } from "@/components/admin/ExtraForm";

export const metadata: Metadata = { title: "Edit Extra" };

export default async function EditExtraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const extra = await getExtraAdmin(id);
  if (!extra) notFound();

  const boundUpdate = updateExtra.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">{extra.name_en}</h1>
      <div className="max-w-xl rounded-xl border border-border bg-background p-6">
        <ExtraForm action={boundUpdate} initial={extra} submitLabel="Save Changes" />
      </div>
    </div>
  );
}
