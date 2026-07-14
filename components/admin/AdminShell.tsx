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
import { AdminNav } from "./AdminNav";

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
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AdminNav items={[...visibleItems]} userEmail={user.email} logoutAction={logoutAdmin} />
      <main className="flex-1 overflow-x-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}
