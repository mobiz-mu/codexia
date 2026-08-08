import type { ReactNode } from "react";
import Link from "next/link";

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-bold text-ink sm:text-2xl">{title}</h1>
      {action}
    </div>
  );
}

export function PageHeaderAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-action-dark hover:shadow-md"
    >
      {children}
    </Link>
  );
}
