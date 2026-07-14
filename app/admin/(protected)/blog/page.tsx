import type { Metadata } from "next";
import Link from "next/link";
import { listPostsAdmin } from "@/lib/actions/admin/blog";

export const metadata: Metadata = { title: "Blog" };

export default async function AdminBlogPage() {
  const posts = await listPostsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Blog</h1>
        <Link href="/admin/blog/new" className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-white">
          Add Post
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Publish At</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/admin/blog/${p.id}`} className="font-medium text-action-dark">
                    {p.title_en}
                  </Link>
                </td>
                <td className="px-4 py-2">{p.blog_categories?.name_en ?? "—"}</td>
                <td className="px-4 py-2 capitalize">{p.status}</td>
                <td className="px-4 py-2">{p.publish_at ? new Date(p.publish_at).toLocaleString("en-GB") : "—"}</td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  No posts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
