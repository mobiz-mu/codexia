import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs({
  items,
  locale,
}: {
  items: { label: string; href?: string }[];
  locale?: string;
}) {
  const jsonLd = locale
    ? (() => {
        const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
        return {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.label,
            item: item.href ? `${siteUrl}/${locale}${item.href === "/" ? "" : item.href}` : undefined,
          })),
        };
      })()
    : null;

  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
            {item.href ? (
              <Link href={item.href} className="hover:text-action-dark">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
