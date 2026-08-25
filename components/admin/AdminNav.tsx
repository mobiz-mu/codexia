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
  CalendarPlus,
  CalendarRange,
  ArrowLeftRight,
  Car,
  LayoutGrid,
  ShieldOff,
  Receipt,
  PackagePlus,
  Tags,
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
  MapPin,
  Wrench,
  ShieldAlert,
  Siren,
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
  CalendarPlus,
  CalendarRange,
  ArrowLeftRight,
  Car,
  LayoutGrid,
  ShieldOff,
  Receipt,
  PackagePlus,
  Tags,
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
  MapPin,
  Wrench,
  ShieldAlert,
  Siren,
} satisfies Record<string, LucideIcon>;

export type AdminIconName = keyof typeof ICON_MAP;

type NavLink = {
  type: "link";
  href: string;
  label: string;
  icon: AdminIconName;
  permission?: string | null;
  badge?: number;
};
type NavGroup = {
  type: "group";
  label: string;
  icon: AdminIconName;
  items: { href: string; label: string; icon: AdminIconName; permission?: string | null; badge?: number }[];
};
export type AdminNavEntry = NavLink | NavGroup;

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white"
      aria-label={`${count} urgent`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

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
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
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
                "flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                active ? "bg-ops-accent text-white" : "text-ops-ink-inv hover:bg-ops-frame-3"
              )}
            >
              <Icon
                className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-ops-ink-inv-2")}
                aria-hidden="true"
              />
              {entry.label}
              {entry.badge !== undefined && <NavBadge count={entry.badge} />}
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
                "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors",
                groupActive ? "text-ops-accent" : "text-ops-ink-inv-2 hover:bg-ops-frame-3 hover:text-ops-ink-inv"
              )}
            >
              <GroupIcon
                className={cn("h-4 w-4 shrink-0", groupActive ? "text-ops-accent" : "text-ops-ink-inv-2")}
                aria-hidden="true"
              />
              <span className="flex-1 text-left">{entry.label}</span>
              <ChevronDown
                className={cn("h-3.5 w-3.5 shrink-0 text-ops-ink-inv-2 transition-transform duration-200", open && "rotate-180")}
                aria-hidden="true"
              />
            </button>
            {open && (
              <div className="mb-1 ml-3.5 mt-0.5 flex flex-col gap-px border-l border-ops-rail pl-2">
                {entry.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = ICON_MAP[item.icon];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2 rounded-sm px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                        active ? "bg-ops-accent text-white" : "text-ops-ink-inv hover:bg-ops-frame-3"
                      )}
                    >
                      <Icon
                        className={cn("h-3.5 w-3.5 shrink-0", active ? "text-white" : "text-ops-ink-inv-2")}
                        aria-hidden="true"
                      />
                      {item.label}
                      {item.badge !== undefined && <NavBadge count={item.badge} />}
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
      <div className="flex items-center justify-between border-b border-ops-rail bg-ops-frame-2 px-4 py-2.5 lg:hidden">
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
              className="rounded-sm border border-ops-rail p-2 text-ops-ink-inv transition-colors hover:border-ops-accent hover:text-ops-accent"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-sm p-2 text-ops-ink-inv transition-colors hover:bg-ops-frame-3"
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
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-ops-frame-2 shadow-xl">
            <div className="flex items-center justify-between border-b border-ops-rail p-4">
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
                className="rounded-sm p-1.5 text-ops-ink-inv hover:bg-ops-frame-3"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {navLinks(() => setMobileOpen(false))}
            <div className="border-t border-ops-rail p-3">
              <p className="truncate px-3 text-xs text-ops-ink-inv-2">{userEmail}</p>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="mt-1 flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium text-ops-ink-inv hover:bg-ops-frame-3"
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
      <aside className="hidden w-56 shrink-0 flex-col border-r border-ops-rail bg-ops-frame-2 lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex">
        <div className="flex items-center border-b border-ops-rail p-3">
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
