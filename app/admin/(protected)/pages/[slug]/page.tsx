import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPolicyPageAdmin } from "@/lib/actions/admin/pages";
import { PolicyVersionForm } from "@/components/admin/PolicyVersionForm";

export const metadata: Metadata = { title: "Edit Policy Page" };

export default async function EditPolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getPolicyPageAdmin(slug);
  if (!result) notFound();

  const { page, versions } = result;
  const latest = versions[0];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">{page.title_en}</h1>
      <p className="text-sm text-muted">
        Current version: {latest?.version ?? "none"}. Publishing creates a new version — existing
        booking policy acceptances always keep pointing at the version they actually accepted.
      </p>

      <div className="max-w-3xl rounded-xl border border-border bg-background p-6">
        <PolicyVersionForm pageId={page.id} latestBodyEn={latest?.body_en} latestBodyFr={latest?.body_fr} />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-ink">Version History</h2>
        <ul className="flex flex-col gap-1 text-sm text-muted">
          {versions.map((v) => (
            <li key={v.id}>
              v{v.version} — published {new Date(v.published_at).toLocaleString("en-GB")}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
