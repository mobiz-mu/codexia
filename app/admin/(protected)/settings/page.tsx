import type { Metadata } from "next";
import { getEmailReadiness, listSettingsAdmin } from "@/lib/actions/admin/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { EmailReadinessPanel } from "@/components/admin/EmailReadinessPanel";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  // Independent reads — the readiness probe makes an outbound call to Resend,
  // so paying for it sequentially would visibly slow the page.
  const [settings, readiness] = await Promise.all([listSettingsAdmin(), getEmailReadiness()]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Site Settings" />
      <div className="max-w-4xl rounded-xl border border-border bg-background p-6 shadow-sm">
        <EmailReadinessPanel readiness={readiness} />
      </div>
      <div className="max-w-4xl rounded-xl border border-border bg-background p-6 shadow-sm">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
