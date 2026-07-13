import Link from "next/link";
import Image from "next/image";
import {
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
  Newspaper,
  Image as ImageIcon,
  HelpCircle,
  FileText,
  Mail,
  MailPlus,
  MessageSquare,
  Bell,
  Settings,
  BarChart3,
  UserCog,
} from "lucide-react";
import type { CurrentAdminUser } from "@/lib/auth/get-current-admin-user";
import { logoutAdmin } from "@/lib/auth/actions";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, permission: null },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays, permission: "manage_bookings" },
  { href: "/admin/calendar", label: "Booking Calendar", icon: CalendarRange, permission: "manage_bookings" },
  { href: "/admin/vehicles", label: "Vehicles", icon: Car, permission: "manage_vehicles" },
  { href: "/admin/categories", label: "Categories", icon: LayoutGrid, permission: "manage_vehicles" },
  { href: "/admin/extras", label: "Extras", icon: PackagePlus, permission: "manage_vehicles" },
  { href: "/admin/availability", label: "Availability", icon: ShieldOff, permission: "manage_vehicles" },
  {
    href: "/admin/payment-proofs",
    label: "Payment Proofs",
    icon: ReceiptText,
    permission: "approve_payment_proofs",
  },
  { href: "/admin/invoices", label: "Invoices", icon: Receipt, permission: "create_invoices" },
  { href: "/admin/customers", label: "Customers", icon: Users, permission: "manage_bookings" },
  { href: "/admin/reviews", label: "Reviews", icon: Star, permission: "approve_reviews" },
  { href: "/admin/blog", label: "Blog", icon: Newspaper, permission: "manage_content" },
  { href: "/admin/banners", label: "Hero Banners", icon: ImageIcon, permission: "manage_content" },
  { href: "/admin/faq", label: "FAQ", icon: HelpCircle, permission: "manage_content" },
  { href: "/admin/pages", label: "Pages", icon: FileText, permission: "manage_content" },
  { href: "/admin/email-templates", label: "Email Templates", icon: Mail, permission: "manage_content" },
  { href: "/admin/newsletter", label: "Newsletter", icon: MailPlus, permission: "manage_content" },
  { href: "/admin/messages", label: "Contact Messages", icon: MessageSquare, permission: "manage_content" },
  { href: "/admin/notifications", label: "Notifications", icon: Bell, permission: null },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, permission: "view_analytics" },
  { href: "/admin/users", label: "Users", icon: UserCog, permission: "manage_users" },
  { href: "/admin/settings", label: "Settings", icon: Settings, permission: "manage_settings" },
] as const;

export function AdminShell({
  user,
  children,
}: {
  user: CurrentAdminUser;
  children: React.ReactNode;
}) {
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || user.permissions.has(item.permission)
  );

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Image src="/logo-mark.svg" alt="Codexia" width={32} height={32} />
          <span className="font-semibold text-ink">Codexia Admin</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface"
            >
              <item.icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <p className="truncate px-3 text-xs text-muted">{user.email}</p>
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface"
            >
              Sign Out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto p-6">{children}</main>
    </div>
  );
}
