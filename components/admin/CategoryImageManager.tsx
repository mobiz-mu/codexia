"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { uploadCategoryImage, deleteCategoryImage } from "@/lib/actions/admin/categories";
import { publicStorageUrl } from "@/lib/supabase/storage";

export function CategoryImageManager({
  categoryId,
  imagePath,
}: {
  categoryId: string;
  imagePath: string | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const url = publicStorageUrl("category-images", imagePath);

  function handleUpload(formData: FormData) {
    startTransition(async () => {
      await uploadCategoryImage(categoryId, formData);
      formRef.current?.reset();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!imagePath) return;
    startTransition(async () => {
      await deleteCategoryImage(categoryId, imagePath);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-ink">Category Image</label>
      <p className="text-xs text-muted">
        Recommended 1200×800px, WebP preferred (JPEG/PNG also accepted), max 3MB.
      </p>
      <div className="relative aspect-[3/2] w-48 overflow-hidden rounded-lg border border-border bg-surface">
        {url ? (
          <Image src={url} alt="" fill className="object-cover" sizes="192px" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">No image</div>
        )}
      </div>
      <form ref={formRef} action={handleUpload} className="flex items-center gap-3">
        <input
          type="file"
          name="image"
          accept="image/webp,image/jpeg,image/png"
          required
          className="text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
        >
          Upload
        </button>
      </form>
      {imagePath && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="self-start text-xs text-red-600 disabled:opacity-60"
        >
          Remove image
        </button>
      )}
    </div>
  );
}
