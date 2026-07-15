"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  Car,
  LayoutGrid,
  ShieldOff,
  ReceiptText,
  Receipt,
  PackagePlus,
  Users,
  Star,
  HelpCircle,
  FileText,
  Mail,
  MailPlus,
  MessageSquare,
  Bell,
  Settings,
  BarChart3,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// Server Components can't pass component/function references to Client
// Components across the RSC boundary (only plain serializable values). The
// server passes icon *names*; this map resolves them to the actual Lucide
// components here, on the client side.
const ICON_MAP = {
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  Car,
  LayoutGrid,
  ShieldOff,
  ReceiptText,
  Receipt,
  PackagePlus,
  Users,
  Star,
  HelpCircle,
  FileText,
  Mail,
  MailPlus,
  MessageSquare,
  Bell,
  Settings,
  BarChart3,
  UserCog,
} satisfies Record<string, LucideIcon>;

export type AdminIconName = keyof typeof ICON_MAP;

type NavLink = { type: "link"; href: string; label: string; icon: AdminIconName; permission?: string | null };
type NavGroup = {
  type: "group";
  label: string;
  icon: AdminIconName;
  items: { href: string; label: string; icon: AdminIconName; permission?: string | null }[];
};
export type AdminNavEntry = NavLink | NavGroup;

export function AdminNav({
  items,
  userEmail,
  logoutAction,
}: {
  items: AdminNavEntry[];
  userEmail: string;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));
  const isGroupActive = (group: NavGroup) => group.items.some((item) => isActive(item.href));

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const entry of items) {
      if (entry.type === "group") initial[entry.label] = isGroupActive(entry);
    }
    return initial;
  });

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  const navLinks = (onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {items.map((entry) => {
        if (entry.type === "link") {
          const active = isActive(entry.href);
          const Icon = ICON_MAP[entry.icon];
          return (
            <Link
              key={entry.href}
              href={entry.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary-tint text-primary-dark" : "text-ink hover:bg-surface"
              )}
            >
              <Icon
                className={cn("h-4 w-4 shrink-0", active ? "text-primary-dark" : "text-muted")}
                aria-hidden="true"
              />
              {entry.label}
            </Link>
          );
        }

        const GroupIcon = ICON_MAP[entry.icon];
        const groupActive = isGroupActive(entry);
        const open = openGroups[entry.label] ?? groupActive;

        return (
          <div key={entry.label}>
            <button
              type="button"
              onClick={() => toggleGroup(entry.label)}
              aria-expanded={open}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                groupActive ? "text-primary-dark" : "text-ink hover:bg-surface"
              )}
            >
              <GroupIcon
                className={cn("h-4 w-4 shrink-0", groupActive ? "text-primary-dark" : "text-muted")}
                aria-hidden="true"
              />
              <span className="flex-1 text-left">{entry.label}</span>
              <ChevronDown
                className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform", open && "rotate-180")}
                aria-hidden="true"
              />
            </button>
            {open && (
              <div className="ml-4 mt-0.5 flex flex-col gap-1 border-l border-border pl-3">
                {entry.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = ICON_MAP[item.icon];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-primary-tint text-primary-dark" : "text-ink hover:bg-surface"
                      )}
                    >
                      <Icon
                        className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary-dark" : "text-muted")}
                        aria-hidden="true"
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile topbar */}
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3 lg:hidden">
        <Image
          src="/images/codexia-logo.png"
          alt="Codexia"
          width={512}
          height={512}
          priority
          className="h-9 w-auto object-contain"
        />
        <div className="flex items-center gap-1.5">
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="rounded-full border border-border p-2 text-ink transition-colors hover:border-primary hover:text-primary-dark"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
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
              <Image
                src="/images/codexia-logo.png"
                alt="Codexia"
                width={512}
                height={512}
                className="h-9 w-auto object-contain"
              />
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

      {/* Desktop sidebar — fixed to the viewport so only the main content area scrolls */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-background lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex">
        <div className="flex items-center border-b border-border p-4">
          <Image
            src="/images/codexia-logo.png"
            alt="Codexia"
            width={512}
            height={512}
            priority
            className="h-10 w-auto object-contain"
          />
        </div>
        {navLinks()}
      </aside>
    </>
  );
}
