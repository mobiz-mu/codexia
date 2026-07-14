"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type NavItem = { href: string; label: string; icon: LucideIcon };

export function AdminNav({
  items,
  userEmail,
  logoutAction,
}: {
  items: NavItem[];
  userEmail: string;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

  const navLinks = (onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary-tint text-primary-dark" : "text-ink hover:bg-surface"
            )}
          >
            <item.icon
              className={cn("h-4 w-4 shrink-0", active ? "text-primary-dark" : "text-muted")}
              aria-hidden="true"
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile topbar */}
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Image src="/logo-mark.svg" alt="Codexia" width={28} height={28} />
          <span className="text-sm font-semibold text-ink">Codexia Admin</span>
        </div>
        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md p-2 text-ink transition-colors hover:bg-surface"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="animate-fade-in-up absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <Image src="/logo-mark.svg" alt="Codexia" width={28} height={28} />
                <span className="text-sm font-semibold text-ink">Codexia Admin</span>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-ink hover:bg-surface"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {navLinks(() => setMobileOpen(false))}
            <div className="border-t border-border p-3">
              <p className="truncate px-3 text-xs text-muted">{userEmail}</p>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-background lg:flex">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Image src="/logo-mark.svg" alt="Codexia" width={32} height={32} />
          <span className="font-semibold text-ink">Codexia Admin</span>
        </div>
        {navLinks()}
        <div className="border-t border-border p-3">
          <p className="truncate px-3 text-xs text-muted">{userEmail}</p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
