import type { Metadata } from "next";
import { listBlogCategoriesAdmin, createPost } from "@/lib/actions/admin/blog";
import { PostForm } from "@/components/admin/PostForm";

export const metadata: Metadata = { title: "Add Post" };

export default async function NewPostPage() {
  const categories = await listBlogCategoriesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Add Post</h1>
      <div className="max-w-3xl rounded-xl border border-border bg-background p-6">
        <PostForm action={createPost} categories={categories} submitLabel="Create Post" />
      </div>
    </div>
  );
}
