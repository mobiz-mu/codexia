"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { uploadPostImage } from "@/lib/actions/admin/blog";
import { publicStorageUrl } from "@/lib/supabase/storage";

export function PostImageUpload({ postId, currentPath }: { postId: string; currentPath: string | null }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const url = publicStorageUrl("blog", currentPath);

  function handleUpload(formData: FormData) {
    startTransition(async () => {
      await uploadPostImage(postId, formData);
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {url && (
        <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-lg bg-surface">
          <Image src={url} alt="Featured" fill className="object-cover" />
        </div>
      )}
      <form ref={formRef} action={handleUpload} className="flex items-center gap-3">
        <input type="file" name="image" accept="image/*" required className="text-sm" />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Upload
        </button>
      </form>
    </div>
  );
}
