import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostAdmin, updatePost } from "@/lib/actions/admin/blog";
import { PostForm } from "@/components/admin/PostForm";
import { PostImageUpload } from "@/components/admin/PostImageUpload";

export const metadata: Metadata = { title: "Edit Post" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { post, categories } = await getPostAdmin(id);
  if (!post) notFound();

  const boundUpdate = updatePost.bind(null, id);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-ink">{post.title_en}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-background p-6">
          <h2 className="mb-4 font-semibold text-ink">Details</h2>
          <PostForm action={boundUpdate} categories={categories} initial={post} submitLabel="Save Changes" />
        </div>
        <div className="rounded-xl border border-border bg-background p-6">
          <h2 className="mb-4 font-semibold text-ink">Featured Image</h2>
          <PostImageUpload postId={id} currentPath={post.featured_image_path} />
        </div>
      </div>
    </div>
  );
}
