import { setRequestLocale } from "next-intl/server";
import { MauritiusSubpage } from "@/components/site/MauritiusSubpage";

export default async function PlacesToVisitPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MauritiusSubpage sectionKey="placesToVisit" />;
}
