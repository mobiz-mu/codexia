"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  uploadVehicleImage,
  setMainImage,
  deleteVehicleImage,
  reorderVehicleImage,
} from "@/lib/actions/admin/vehicles";
import { publicStorageUrl } from "@/lib/supabase/storage";

type VehicleImage = { id: string; path: string; is_main: boolean; alt_en: string | null };

export function VehicleImageManager({
  vehicleId,
  images,
}: {
  vehicleId: string;
  images: VehicleImage[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleUpload(formData: FormData) {
    setUploadError(null);
    startTransition(async () => {
      const result = await uploadVehicleImage(vehicleId, formData);
      if (!result.ok) {
        setUploadError(result.error);
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  function handleSetMain(imageId: string) {
    startTransition(async () => {
      await setMainImage(vehicleId, imageId);
      router.refresh();
    });
  }

  function handleDelete(imageId: string, path: string) {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteVehicleImage(vehicleId, imageId, path);
      if (!result.ok) {
        setDeleteError(result.error ?? "Failed to delete the image.");
        return;
      }
      router.refresh();
    });
  }

  function handleReorder(imageId: string, direction: "up" | "down") {
    startTransition(async () => {
      await reorderVehicleImage(imageId, direction, vehicleId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form ref={formRef} action={handleUpload} className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            required
            className="text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {pending ? "Uploading..." : "Upload"}
          </button>
        </div>
        <p className="text-xs text-muted">JPEG, PNG, or WebP. Max 8 MB.</p>
        {uploadError && (
          <p className="text-sm text-red-600" role="alert">
            {uploadError}
          </p>
        )}
      </form>

      {deleteError && (
        <p className="text-sm text-red-600" role="alert">
          {deleteError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((img) => {
          const url = publicStorageUrl("vehicle-images", img.path);
          return (
            <div key={img.id} className="flex flex-col gap-1 rounded-lg border border-border p-2">
              <div className="relative aspect-square w-full overflow-hidden rounded bg-surface">
                {url && (
                  <Image
                    src={url}
                    alt={img.alt_en ?? ""}
                    fill
                    className="object-cover"
                    sizes="(min-width: 640px) 25vw, 50vw"
                  />
                )}
              </div>
              {img.is_main && <span className="text-xs font-semibold text-action-dark">Main</span>}
              <div className="flex flex-wrap gap-1">
                {!img.is_main && (
                  <button type="button" onClick={() => handleSetMain(img.id)} className="text-xs text-action-dark">
                    Set main
                  </button>
                )}
                <button type="button" onClick={() => handleReorder(img.id, "up")} className="text-xs text-muted">
                  ↑
                </button>
                <button type="button" onClick={() => handleReorder(img.id, "down")} className="text-xs text-muted">
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(img.id, img.path)}
                  className="text-xs text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
