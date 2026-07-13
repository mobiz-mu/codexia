import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBannerAdmin, updateBanner } from "@/lib/actions/admin/banners";
import { BannerForm } from "@/components/admin/BannerForm";

export const metadata: Metadata = { title: "Edit Banner" };

export default async function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const banner = await getBannerAdmin(id);
  if (!banner) notFound();

  const boundUpdate = updateBanner.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Edit Banner</h1>
      <div className="max-w-2xl rounded-xl border border-border bg-background p-6">
        <BannerForm action={boundUpdate} initial={banner} submitLabel="Save Changes" />
      </div>
    </div>
  );
}
