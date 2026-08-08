import type { LucideIcon } from "lucide-react";

export function UseCaseHighlights({
  highlights,
}: {
  highlights: { icon: LucideIcon; title: string; text: string }[];
}) {
  return (
    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
      {highlights.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-6 shadow-sm">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-tint text-primary-dark">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <p className="text-sm text-muted">{text}</p>
        </div>
      ))}
    </div>
  );
}
