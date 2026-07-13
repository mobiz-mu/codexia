import { setRequestLocale } from "next-intl/server";
import { MauritiusSubpage } from "@/components/site/MauritiusSubpage";

export default async function AirportGuidePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MauritiusSubpage sectionKey="airportGuide" />;
}
