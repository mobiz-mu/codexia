import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { ResendBookingLinkForm } from "@/components/site/ResendBookingLinkForm";
import { buildAlternates } from "@/lib/seo/alternates";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "myBooking.landing" });
  return { title: t("title"), alternates: buildAlternates(locale, "/my-booking") };
}

export default async function MyBookingLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("myBooking.landing");

  return (
    <section className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("title")}</h1>
      <p className="mt-4 text-muted">{t("intro")}</p>
      <div className="mt-8">
        <ResendBookingLinkForm
          labels={{ emailLabel: t("emailLabel"), submit: t("submit"), sent: t("sent") }}
        />
      </div>
    </section>
  );
}
