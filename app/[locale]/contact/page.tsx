import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Phone, Mail, MessageCircle } from "lucide-react";
import { ContactForm } from "@/components/site/ContactForm";
import { getSiteSettings } from "@/lib/config/get-site-settings";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return buildPageMetadata({ locale, path: "/contact", title: t("title"), description: t("subtitle") });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  const settings = await getSiteSettings();

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t("subtitle")}</p>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-6 text-sm text-ink shadow-sm">
          <a
            href={`tel:${settings.phone.replace(/\s+/g, "")}`}
            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-dark">
              <Phone className="h-4 w-4" aria-hidden="true" />
            </span>
            {settings.phone}
          </a>
          <a
            href={`https://wa.me/${settings.whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-dark">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </span>
            {settings.whatsapp}
          </a>
          <a
            href={`mailto:${settings.email}`}
            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-dark">
              <Mail className="h-4 w-4" aria-hidden="true" />
            </span>
            {settings.email}
          </a>
        </div>

        <div className="lg:col-span-2">
          <ContactForm
            labels={{
              name: t("form.name"),
              email: t("form.email"),
              phone: t("form.phone"),
              subject: t("form.subject"),
              message: t("form.message"),
              submit: t("form.submit"),
              success: t("form.success"),
              error: t("form.error"),
            }}
          />
        </div>
      </div>
    </section>
  );
}
