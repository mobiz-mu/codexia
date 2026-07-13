import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { MauritiusSubpage, getMauritiusSubpageMetadata } from "@/components/site/MauritiusSubpage";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  return getMauritiusSubpageMetadata(locale, "airportGuide");
}

export default async function AirportGuidePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MauritiusSubpage sectionKey="airportGuide" locale={locale} />;
}
