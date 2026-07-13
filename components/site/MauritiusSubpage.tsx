import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";

export async function MauritiusSubpage({
  sectionKey,
}: {
  sectionKey: "placesToVisit" | "drivingGuide" | "airportGuide" | "travelTips";
}) {
  const t = await getTranslations("mauritius");

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: t("title"), href: "/mauritius" },
          { label: t(`${sectionKey}.title`) },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {t(`${sectionKey}.title`)}
      </h1>
      <p className="mt-4 text-lg text-ink">{t(`${sectionKey}.text`)}</p>
    </section>
  );
}
