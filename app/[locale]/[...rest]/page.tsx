import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  notFound();
}
