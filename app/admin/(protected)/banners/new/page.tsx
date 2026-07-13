import type { Metadata } from "next";
import { createBanner } from "@/lib/actions/admin/banners";
import { BannerForm } from "@/components/admin/BannerForm";

export const metadata: Metadata = { title: "Add Banner" };

export default function NewBannerPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Add Banner</h1>
      <div className="max-w-2xl rounded-xl border border-border bg-background p-6">
        <BannerForm action={createBanner} submitLabel="Create Banner" />
      </div>
    </div>
  );
}
