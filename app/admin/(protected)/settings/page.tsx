import type { Metadata } from "next";
import { listSettingsAdmin } from "@/lib/actions/admin/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const settings = await listSettingsAdmin();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Site Settings" />
      <div className="max-w-4xl rounded-xl border border-border bg-background p-6 shadow-sm">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
