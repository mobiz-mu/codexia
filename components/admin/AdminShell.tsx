import { Suspense } from "react";
import type { CurrentAdminUser } from "@/lib/auth/get-current-admin-user";
import { logoutAdmin } from "@/lib/auth/actions";
import { LogOut } from "lucide-react";
import { AdminNav, type AdminNavEntry } from "./AdminNav";
import { getComplianceSidebarBadgeCount } from "@/lib/actions/admin/compliance";

const NAV_ITEMS: AdminNavEntry[] = [
  { type: "link", href: "/admin", label: "Overview", icon: "LayoutDashboard", permission: null },
  { type: "link", href: "/admin/notifications", label: "Notifications", icon: "Bell", permission: null },
  {
    type: "group",
    label: "Bookings",
    icon: "CalendarDays",
    items: [
      { href: "/admin/bookings", label: "Bookings", icon: "CalendarDays", permission: "manage_bookings" },
      { href: "/admin/calendar", label: "Calendar", icon: "CalendarRange", permission: "manage_bookings" },
      { href: "/admin/availability", label: "Availability", icon: "ShieldOff", permission: "manage_vehicles" },
    ],
  },
  {
    type: "group",
    label: "Fleet",
    icon: "Car",
    items: [
      { href: "/admin/vehicles", label: "Vehicles", icon: "Car", permission: "manage_vehicles" },
      { href: "/admin/categories", label: "Categories", icon: "LayoutGrid", permission: "manage_vehicles" },
      { href: "/admin/extras", label: "Extras", icon: "PackagePlus", permission: "manage_vehicles" },
      { href: "/admin/locations", label: "Locations", icon: "MapPin", permission: "manage_content" },
      { href: "/admin/maintenance", label: "Maintenance Records", icon: "Wrench", permission: "view_maintenance" },
      { href: "/admin/compliance", label: "Fleet Documents & Compliance", icon: "ShieldAlert", permission: "view_compliance" },
      { href: "/admin/incidents", label: "Accident & Damage History", icon: "Siren", permission: "view_incidents" },
    ],
  },
  {
    type: "group",
    label: "Finance",
    icon: "Receipt",
    items: [{ href: "/admin/invoices", label: "Invoices", icon: "Receipt", permission: "create_invoices" }],
  },
  {
    type: "group",
    label: "Customers & Communication",
    icon: "Users",
    items: [
      { href: "/admin/customers", label: "Customers", icon: "Users", permission: "manage_bookings" },
      { href: "/admin/messages", label: "Messages", icon: "MessageSquare", permission: "manage_content" },
      { href: "/admin/reviews", label: "Reviews", icon: "Star", permission: "approve_reviews" },
      { href: "/admin/newsletter", label: "Newsletter", icon: "MailPlus", permission: "manage_content" },
    ],
  },
  {
    type: "group",
    label: "Website",
    icon: "FileText",
    items: [
      { href: "/admin/pages", label: "Pages", icon: "FileText", permission: "manage_content" },
      { href: "/admin/faq", label: "FAQ", icon: "HelpCircle", permission: "manage_content" },
      { href: "/admin/email-templates", label: "Email Templates", icon: "Mail", permission: "manage_content" },
    ],
  },
  {
    type: "group",
    label: "Administration",
    icon: "Settings",
    items: [
      { href: "/admin/users", label: "Users", icon: "UserCog", permission: "manage_users" },
      { href: "/admin/analytics", label: "Analytics", icon: "BarChart3", permission: "view_analytics" },
      { href: "/admin/settings", label: "Settings", icon: "Settings", permission: "manage_settings" },
    ],
  },
];

function filterNavForPermissions(entries: AdminNavEntry[], permissions: Set<string>): AdminNavEntry[] {
  return entries
    .map((entry) => {
      if (entry.type === "link") {
        return !entry.permission || permissions.has(entry.permission) ? entry : null;
      }
      const items = entry.items.filter((item) => !item.permission || permissions.has(item.permission));
      return items.length > 0 ? { ...entry, items } : null;
    })
    .filter((entry): entry is AdminNavEntry => entry !== null);
}

// The sidebar badge count is fetched here (not cached, not deferred to a
// client-side effect) so every admin page render reflects the current
// alarm count — it changes daily as documents move through the 30-day
// window without any mutation happening to trigger a cache invalidation.
function withComplianceBadge(entries: AdminNavEntry[], badge: number): AdminNavEntry[] {
  return entries.map((entry) => {
    if (entry.type === "link") return entry;
    return {
      ...entry,
      items: entry.items.map((item) => (item.href === "/admin/compliance" ? { ...item, badge } : item)),
    };
  });
}

// A tiny async component (not the whole shell) so this is the only thing a
// Suspense boundary needs to wait on — the compliance count stays genuinely
// fresh on every render (never cached, never deferred to a client effect),
// but it no longer sits in front of `children`'s own data-fetching: the page
// content now streams immediately instead of queuing behind this one extra
// DB round trip that only the sidebar badge needs.
async function AdminNavWithBadge({
  items,
  hasComplianceView,
  userEmail,
}: {
  items: AdminNavEntry[];
  hasComplianceView: boolean;
  userEmail: string;
}) {
  const complianceBadge = hasComplianceView ? await getComplianceSidebarBadgeCount() : 0;
  const visibleItems = withComplianceBadge(items, complianceBadge);
  return <AdminNav items={visibleItems} userEmail={userEmail} logoutAction={logoutAdmin} />;
}

export function AdminShell({
  user,
  children,
}: {
  user: CurrentAdminUser;
  children: React.ReactNode;
}) {
  const visibleItems = filterNavForPermissions(NAV_ITEMS, user.permissions);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Suspense fallback={<AdminNav items={visibleItems} userEmail={user.email} logoutAction={logoutAdmin} />}>
        <AdminNavWithBadge
          items={visibleItems}
          hasComplianceView={user.permissions.has("view_compliance")}
          userEmail={user.email}
        />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col lg:ml-60">
        <header className="sticky top-0 z-30 hidden items-center justify-end gap-3 border-b border-border bg-background/95 px-6 py-3 backdrop-blur lg:flex">
          <span className="truncate text-sm text-muted">{user.email}</span>
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-primary hover:text-primary-dark"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign Out
            </button>
          </form>
        </header>
        <main className="flex-1 overflow-x-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
