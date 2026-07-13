"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createFaqEntry, type FaqFormState } from "@/lib/actions/admin/faq";

export function CreateFaqEntryForm({ categories }: { categories: { id: string; name_en: string }[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createFaqEntry, { status: "idle" } as FaqFormState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
      <h3 className="font-semibold text-ink">Add FAQ Entry</h3>
      <select name="categoryId" required className="rounded-lg border border-border px-3 py-2 text-sm">
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name_en}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="questionEn" placeholder="Question (EN)" required className="rounded-lg border border-border px-3 py-2 text-sm" />
        <input name="questionFr" placeholder="Question (FR)" required className="rounded-lg border border-border px-3 py-2 text-sm" />
        <textarea name="answerEn" placeholder="Answer (EN)" required rows={2} className="rounded-lg border border-border px-3 py-2 text-sm" />
        <textarea name="answerFr" placeholder="Answer (FR)" required rows={2} className="rounded-lg border border-border px-3 py-2 text-sm" />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add Entry"}
      </button>
    </form>
  );
}
