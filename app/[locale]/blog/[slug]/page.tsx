import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getPostBySlug } from "@/lib/data/blog";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { publicStorageUrl } from "@/lib/supabase/storage";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(props: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const post = await getPostBySlug(slug);
  if (!post) {
    const t = await getTranslations({ locale, namespace: "notFound" });
    return { ...(await buildPageMetadata({ locale, path: `/blog/${slug}`, title: t("title"), description: t("description") })), robots: { index: false } };
  }

  const title = locale === "fr" ? post.title_fr : post.title_en;
  const description = locale === "fr" ? post.excerpt_fr : post.excerpt_en;
  return buildPageMetadata({
    locale,
    path: `/blog/${slug}`,
    title,
    description: description ?? undefined,
    canonicalOverride: post.canonical_path,
    image: publicStorageUrl("blog", post.featured_image_path),
    imageAlt: title,
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = await getPostBySlug(slug);
  if (!post || post.status !== "published") notFound();

  const t = await getTranslations("blog");
  const tCommon = await getTranslations("common");
  const title = locale === "fr" ? post.title_fr : post.title_en;
  const body = locale === "fr" ? post.body_fr : post.body_en;
  const imageUrl = publicStorageUrl("blog", post.featured_image_path);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    image: imageUrl ?? undefined,
    datePublished: post.publish_at ?? post.created_at,
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Breadcrumbs
        locale={locale}
        items={[
          { label: tCommon("home"), href: "/" },
          { label: t("title"), href: "/blog" },
          { label: title },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>

      {imageUrl && (
        <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-xl bg-surface">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            priority
            sizes="(min-width: 768px) 768px, 100vw"
          />
        </div>
      )}

      {body && (
        <div className="mt-8 max-w-none whitespace-pre-wrap leading-relaxed text-ink">{body}</div>
      )}
    </article>
  );
}
