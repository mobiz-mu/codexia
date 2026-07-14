"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

type GalleryImage = { url: string; alt: string };

export function VehicleGallery({ images, emptyLabel }: { images: GalleryImage[]; emptyLabel: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface">
        {active ? (
          <Image
            key={active.url}
            src={active.url}
            alt={active.alt}
            fill
            className="animate-fade-in-up object-cover"
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">{emptyLabel}</div>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3">
          {images.slice(0, 8).map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`${img.alt} ${i + 1}`}
              aria-current={i === activeIndex}
              className={cn(
                "relative aspect-square overflow-hidden rounded-lg bg-surface ring-2 ring-offset-2 transition-all",
                i === activeIndex ? "ring-primary" : "ring-transparent hover:ring-border"
              )}
            >
              <Image src={img.url} alt={img.alt} fill className="object-cover" sizes="12vw" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
