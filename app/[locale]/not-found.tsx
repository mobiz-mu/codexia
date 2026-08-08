import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return { title: t("title"), description: t("description") };
}

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-32 text-center sm:px-6 lg:px-8">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint text-primary-dark">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="text-4xl font-bold text-ink">{t("title")}</h1>
      <p className="text-muted">{t("description")}</p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-action px-6 py-3 text-sm font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md"
      >
        {t("cta")}
      </Link>
    </section>
  );
}
