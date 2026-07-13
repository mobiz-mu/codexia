import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-32 text-center sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold text-ink">{t("title")}</h1>
      <p className="text-muted">{t("description")}</p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        {t("cta")}
      </Link>
    </section>
  );
}
