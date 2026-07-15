import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo/metadata";

const CREDITS = [
  {
    file: "/images/sections/why-choose-bg.webp",
    title: "Sunbathing at Le Morne Beach in Mauritius",
    author: "dronepicr",
    license: "CC BY 2.0",
    source: "https://commons.wikimedia.org/wiki/File:Sunbathing_at_Le_Morne_Beach_in_Mauritius_(53697787846).jpg",
  },
  {
    file: "/images/mauritius/gallery-1.webp",
    title: "Mauritius Île aux Cerfs",
    author: "Arne Müseler",
    license: "CC BY-SA 3.0 DE",
    source: "https://commons.wikimedia.org/wiki/File:Mauritius_%C3%8Ele_aux_Cerfs.jpg",
  },
  {
    file: "/images/mauritius/gallery-2.webp",
    title: "Le Morne Peninsula in Mauritius",
    author: "dronepicr",
    license: "CC BY 2.0",
    source: "https://commons.wikimedia.org/wiki/File:Le_Morne_Peninsula_in_Mauritius_(53697779236).jpg",
  },
  {
    file: "/images/mauritius/gallery-3.webp",
    title: "Chamarel Waterfalls",
    author: "Hansueli Krapf",
    license: "CC BY-SA 3.0",
    source: "https://commons.wikimedia.org/wiki/File:2006-10-02_Chamarel_Waterfalls.jpg",
  },
  {
    file: "/images/mauritius/gallery-4.webp",
    title: "Sir Seewoosagur Ramgoolam International Airport",
    author: "आशीष भटनागर",
    license: "CC BY-SA 3.0",
    source: "https://commons.wikimedia.org/wiki/File:Sir_Seewoosagur_Ramgoolam_International_Airport.jpg",
  },
  {
    file: "/images/mauritius/gallery-5.webp",
    title: "Port Louis Mauritius",
    author: "Ifeatu Nnaobi",
    license: "CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:Port_Louis_Mauritius.jpg",
  },
  {
    file: "/images/categories/economy.webp",
    title: "2017 Suzuki Celerio SZ4 Automatic 1.0",
    author: "Vauxford",
    license: "CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:2017_Suzuki_Celerio_SZ4_Automatic_1.0_Front.jpg",
  },
  {
    file: "/images/categories/compact.webp",
    title: "VW-Polo",
    author: "ГП",
    license: "CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:VW-Polo.jpg",
  },
  {
    file: "/images/categories/sedan.webp",
    title: "Toyota Corolla Hybrid (lateral view)",
    author: "Mariordo (Mario Roberto Durán Ortiz)",
    license: "CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:Lateral_Toyota_Corolla_Hybrid_CRI_10_2021_1613.jpg",
  },
  {
    file: "/images/blog/blog-1.webp",
    title: "Trou aux Cerfs Volcano, Mauritius",
    author: "I rishki",
    license: "CC BY-SA 3.0",
    source: "https://commons.wikimedia.org/wiki/File:Trou_aux_Cerfs_Volcano_Mauritius.JPG",
  },
  {
    file: "/images/blog/blog-2.webp",
    title: "Sugar cane fields, Mauritius",
    author: "Fenous",
    license: "CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:Sugar_cane_fields,_Mauritius.jpeg",
  },
  {
    file: "/images/blog/blog-3.webp",
    title: "Pereybere Beach, Mauritius",
    author: "Z thomas",
    license: "CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:Pereybere_Beach_Mauritius_2019-09-27.jpg",
  },
  {
    file: "/images/blog/blog-4.webp",
    title: "Sir Seewoosagur Ramgoolam International Airport",
    author: "आशीष भटनागर",
    license: "CC BY-SA 3.0",
    source: "https://commons.wikimedia.org/wiki/File:Sir_Seewoosagur_Ramgoolam_International_Airport.jpg",
  },
];

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  return buildPageMetadata({
    locale,
    path: "/photo-credits",
    title: locale === "fr" ? "Crédits photo" : "Photo Credits",
    description:
      locale === "fr"
        ? "Attribution des photographies temporaires utilisées sur ce site."
        : "Attribution for the temporary photography used on this site.",
  });
}

export default async function PhotoCreditsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isFr = locale === "fr";

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {isFr ? "Crédits photo" : "Photo Credits"}
      </h1>
      <p className="mt-3 text-muted">
        {isFr
          ? "Les photographies actuellement utilisées sur ce site sont des images temporaires, en attendant les photos officielles de Codexia. Elles proviennent de Wikimedia Commons et sont utilisées sous licence Creative Commons, avec attribution ci-dessous."
          : "The photography currently used on this site is temporary placeholder imagery, pending official Codexia photography. It is sourced from Wikimedia Commons and used under Creative Commons licenses, credited below."}
      </p>

      <ul className="mt-8 flex flex-col gap-4">
        {CREDITS.map((credit) => (
          <li key={credit.file} className="rounded-lg border border-border p-4 text-sm">
            <p className="font-semibold text-ink">{credit.title}</p>
            <p className="mt-1 text-muted">
              {isFr ? "Auteur" : "Author"}: {credit.author} · {credit.license}
            </p>
            <a
              href={credit.source}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-primary-dark underline underline-offset-2"
            >
              {isFr ? "Voir la source" : "View source"}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
