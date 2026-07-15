import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Admin Login" };

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-surface px-4">
      <Image
        src="/images/codexia-logo.png"
        alt="Codexia Ltd"
        width={512}
        height={512}
        className="h-16 w-auto object-contain"
        priority
      />
      <div className="w-full max-w-sm rounded-xl border border-border bg-background p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-ink">Admin Sign In</h1>
        <LoginForm />
      </div>
    </div>
  );
}
