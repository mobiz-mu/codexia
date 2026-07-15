import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Reusable hero banner. Pass `imageSrc` (a path under /public) once real
 * photography is available; without it, falls back to the existing branded
 * gradient so current pages keep their exact look.
 */
export function HeroBanner({
  imageSrc,
  imageAlt,
  children,
}: {
  imageSrc?: string;
  imageAlt?: string;
  children: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-dark to-[#0a5f85] py-20 lg:py-28">
      {imageSrc && (
        <Image
          src={imageSrc}
          alt={imageAlt ?? ""}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      )}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1.5px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden="true"
      />
      {imageSrc && (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/85 via-primary-dark/80 to-[#0a5f85]/85"
          aria-hidden="true"
        />
      )}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}
