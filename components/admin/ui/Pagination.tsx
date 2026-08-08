import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  total,
  itemLabel = "record",
  pageHref,
}: {
  page: number;
  totalPages: number;
  total: number;
  itemLabel?: string;
  pageHref: (targetPage: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <span>
        Page {page} of {totalPages} ({total} {itemLabel}
        {total === 1 ? "" : "s"})
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link
            href={pageHref(page - 1)}
            className="rounded-lg border border-border px-3 py-1.5 transition-colors hover:border-primary hover:bg-primary-tint hover:text-primary-dark"
          >
            Previous
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={pageHref(page + 1)}
            className="rounded-lg border border-border px-3 py-1.5 transition-colors hover:border-primary hover:bg-primary-tint hover:text-primary-dark"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
