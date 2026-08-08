import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getPolicyBySlug } from "@/lib/data/policies";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(props: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const result = await getPolicyBySlug(slug);
  if (!result) {
    const t = await getTranslations({ locale, namespace: "notFound" });
    return { ...(await buildPageMetadata({ locale, path: `/policies/${slug}`, title: t("title"), description: t("description") })), robots: { index: false } };
  }

  const title = locale === "fr" ? result.page.title_fr : result.page.title_en;
  const description =
    locale === "fr"
      ? `${title} de Codexia Ltd pour la location de voitures à Maurice.`
      : `Codexia Ltd's ${title} for car rentals in Mauritius.`;
  return buildPageMetadata({ locale, path: `/policies/${slug}`, title, description });
}

function renderMarkdownLite(body: string) {
  return body.split("\n\n").flatMap((block, blockIndex) => {
    const lines = block.split("\n");
    const elements: ReactNode[] = [];
    let listItems: string[] = [];

    function flushList() {
      if (listItems.length === 0) return;
      elements.push(
        <ul
          key={`${blockIndex}-list-${elements.length}`}
          className="mb-4 list-disc space-y-1 pl-5 text-sm text-ink"
        >
          {listItems.map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </ul>
      );
      listItems = [];
    }

    for (const line of lines) {
      if (line.startsWith("## ")) {
        flushList();
        elements.push(
          <h2
            key={`${blockIndex}-h2-${elements.length}`}
            className="mt-8 mb-3 text-xl font-semibold text-ink first:mt-0"
          >
            {line.replace("## ", "")}
          </h2>
        );
      } else if (line.startsWith("- ")) {
        listItems.push(line.replace(/^- /, ""));
      } else if (line.trim()) {
        flushList();
        elements.push(
          <p key={`${blockIndex}-p-${elements.length}`} className="mb-4 text-sm leading-relaxed text-ink">
            {line}
          </p>
        );
      }
    }
    flushList();

    return elements;
  });
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const result = await getPolicyBySlug(slug);
  if (!result) notFound();

  const t = await getTranslations("policies");
  const tFooter = await getTranslations("footer");
  const tCommon = await getTranslations("common");
  const title = locale === "fr" ? result.page.title_fr : result.page.title_en;
  const body = result.version ? (locale === "fr" ? result.version.body_fr : result.version.body_en) : null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs
        locale={locale}
        items={[
          { label: tCommon("home"), href: "/" },
          { label: tFooter("columns.policies") },
          { label: title },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
      {result.version && (
        <p className="mt-2 text-xs text-muted">
          {t("lastUpdated")}:{" "}
          {new Date(result.version.published_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB")}
        </p>
      )}

      <div className="mt-8">{body ? renderMarkdownLite(body) : null}</div>
    </section>
  );
}
