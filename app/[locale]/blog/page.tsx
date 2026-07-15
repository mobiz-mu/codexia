import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { getPublishedPosts } from "@/lib/data/blog";
import { publicStorageUrl } from "@/lib/supabase/storage";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return buildPageMetadata({ locale, path: "/blog", title: t("title"), description: t("subtitle") });
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const posts = await getPublishedPosts();

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t("subtitle")}</p>

      {posts.length === 0 ? (
        <p className="mt-10 rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {t("empty")}
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const imageUrl = publicStorageUrl("blog", post.featured_image_path);
            const title = locale === "fr" ? post.title_fr : post.title_en;
            const excerpt = locale === "fr" ? post.excerpt_fr : post.excerpt_en;

            return (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              >
                <div className="relative aspect-[16/9] w-full bg-surface">
                  {imageUrl && (
                    <Image
                      src={imageUrl}
                      alt={title}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    />
                  )}
                </div>
                <div className="p-4">
                  <h2 className="text-lg font-semibold text-ink group-hover:text-action-dark">
                    {title}
                  </h2>
                  {excerpt && <p className="mt-1 text-sm text-muted">{excerpt}</p>}
                  <span className="mt-3 inline-block text-sm font-semibold text-action-dark">
                    {t("readMore")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
