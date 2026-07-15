"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";

type CategoryItem = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
};

export function CategoryCarousel({ categories }: { categories: CategoryItem[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows]);

  function scrollBy(direction: "left" | "right") {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.8, 400);
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }

  const showArrows = categories.length > 3;

  return (
    <div className="relative">
      {showArrows && (
        <button
          type="button"
          onClick={() => scrollBy("left")}
          disabled={!canScrollLeft}
          aria-label="Scroll categories left"
          className="absolute -left-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-ink shadow-md transition-all hover:border-primary hover:text-primary-dark disabled:pointer-events-none disabled:opacity-0 lg:flex"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      <div
        ref={scrollerRef}
        role="region"
        aria-label="Vehicle categories"
        tabIndex={0}
        className="hide-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 focus-visible:outline-none"
      >
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="group w-[240px] shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-all hover:-translate-y-1 hover:border-primary hover:shadow-md sm:w-[260px]"
          >
            <div className="relative aspect-[16/9] w-full bg-surface">
              {category.imageUrl ? (
                <Image
                  src={category.imageUrl}
                  alt={category.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="260px"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary-tint to-action-tint text-sm font-medium text-primary-dark">
                  {category.name}
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-ink transition-colors group-hover:text-primary-dark">
                {category.name}
              </h3>
            </div>
          </Link>
        ))}
      </div>

      {showArrows && (
        <button
          type="button"
          onClick={() => scrollBy("right")}
          disabled={!canScrollRight}
          aria-label="Scroll categories right"
          className={cn(
            "absolute -right-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-ink shadow-md transition-all hover:border-primary hover:text-primary-dark disabled:pointer-events-none disabled:opacity-0 lg:flex"
          )}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
