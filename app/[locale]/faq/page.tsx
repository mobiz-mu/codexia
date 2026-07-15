import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { getFaqCategoriesWithEntries } from "@/lib/data/faq";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "faq" });
  return buildPageMetadata({ locale, path: "/faq", title: t("title"), description: t("subtitle") });
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("faq");
  const categories = await getFaqCategoriesWithEntries();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: categories.flatMap((category) =>
      category.faq_entries.map((entry) => ({
        "@type": "Question",
        name: locale === "fr" ? entry.question_fr : entry.question_en,
        acceptedAnswer: {
          "@type": "Answer",
          text: locale === "fr" ? entry.answer_fr : entry.answer_en,
        },
      }))
    ),
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("title")}</h1>
      <p className="mt-2 text-muted">{t("subtitle")}</p>

      <div className="mt-10 flex flex-col gap-10">
        {categories.map((category) => (
          <div key={category.id}>
            <h2 className="mb-4 text-xl font-semibold text-ink">
              {locale === "fr" ? category.name_fr : category.name_en}
            </h2>
            <FaqAccordion
              groupName={`faq-category-${category.id}`}
              entries={category.faq_entries.map((entry) => ({
                id: entry.id,
                question: locale === "fr" ? entry.question_fr : entry.question_en,
                answer: locale === "fr" ? entry.answer_fr : entry.answer_en,
              }))}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
