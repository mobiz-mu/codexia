import type { Metadata } from "next";
import { listSettingsAdmin } from "@/lib/actions/admin/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const settings = await listSettingsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Site Settings</h1>
      <div className="max-w-4xl rounded-xl border border-border bg-background p-6">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
