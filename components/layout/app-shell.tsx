"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

/* ── Nav config ─────────────────────────────────────────────── */
type NavCountKey =
  | "purchaseOrders"
  | "receiving"
  | "expensePOs"
  | "assetPOs"
  | "itemsForReview"
  | "ordersActive"
  | "ordersQuotation"
  | "ordersConfirmed"
  | "ordersOnHold"
  | "ordersProduction"
  | "ordersShipping"
  | "ordersPayment"
  | "accountingReview";

type NavLeaf = {
  kind: "item";
  label: string;
  href: string;
  icon: React.FC<{ className?: string }>;
  countKey?: NavCountKey;
};

type NavSubGroup = {
  kind: "subgroup";
  label: string;
  children: NavLeaf[];
};

type NavGroup = {
  kind: "group";
  label: string;
  icon: React.FC<{ className?: string }>;
  children: (NavLeaf | NavSubGroup)[];
  roles?: string[];
};

type NavEntry = NavLeaf | NavGroup;

const NAV: NavEntry[] = [
  { kind: "item", label: "Dashboard", href: "/dashboard", icon: HomeIcon },
  {
    kind: "group",
    label: "Operations",
    icon: BoxIcon,
    children: [
      {
        kind: "subgroup",
        label: "Management",
        children: [
          { kind: "item", label: "Customer", href: "/dashboard/management/customers", icon: ClipboardIcon },
          { kind: "item", label: "Supplier", href: "/dashboard/management/suppliers", icon: ClipboardIcon },
          { kind: "item", label: "Item List", href: "/dashboard/management/items", icon: ClipboardIcon },
          { kind: "item", label: "Item Category", href: "/dashboard/management/item-categories", icon: ClipboardIcon },
          { kind: "item", label: "Product Modifier", href: "/dashboard/management/product-modifiers", icon: ClipboardIcon },
          { kind: "item", label: "Couriers", href: "/dashboard/management/couriers", icon: ClipboardIcon },
          { kind: "item", label: "Stores", href: "/dashboard/management/stores", icon: ClipboardIcon },
        ],
      },
      {
        kind: "subgroup",
        label: "Orders",
        children: [
          { kind: "item", label: "Active Orders", href: "/dashboard/orders/active-orders", icon: ShoppingCartIcon, countKey: "ordersActive" },
          { kind: "item", label: "Quotation", href: "/dashboard/orders/quotation", icon: ShoppingCartIcon, countKey: "ordersQuotation" },
          { kind: "item", label: "Confirmed", href: "/dashboard/orders/confirmed", icon: ShoppingCartIcon, countKey: "ordersConfirmed" },
          { kind: "item", label: "On Hold", href: "/dashboard/orders/on-hold", icon: ShoppingCartIcon, countKey: "ordersOnHold" },
          { kind: "item", label: "Production", href: "/dashboard/orders/production", icon: ShoppingCartIcon, countKey: "ordersProduction" },
          { kind: "item", label: "Shipping", href: "/dashboard/orders/shipping", icon: ShoppingCartIcon, countKey: "ordersShipping" },
          { kind: "item", label: "Completed", href: "/dashboard/orders/completed", icon: ShoppingCartIcon },
        ],
      },
      {
        kind: "subgroup",
        label: "Inventory",
        children: [
          { kind: "item", label: "Inventory Monitoring", href: "/dashboard/inventory/monitoring", icon: LayersIcon },
          { kind: "item", label: "Items for Review", href: "/dashboard/inventory/items-for-review", icon: LayersIcon, countKey: "itemsForReview" },
          { kind: "item", label: "Item Adjustment", href: "/dashboard/inventory/adjustment", icon: LayersIcon },
        ],
      },
    ],
  },
  {
    kind: "group",
    label: "Purchasing",
    icon: BoxIcon,
    children: [
      { kind: "item", label: "Inventory PO", href: "/dashboard/purchasing/inventory-po", icon: BoxIcon, countKey: "purchaseOrders" },
      { kind: "item", label: "Expense PO", href: "/dashboard/purchasing/expense-po", icon: BoxIcon, countKey: "expensePOs" },
      { kind: "item", label: "Asset PO", href: "/dashboard/purchasing/asset-po", icon: BoxIcon, countKey: "assetPOs" },
      { kind: "item", label: "Receiving", href: "/dashboard/purchasing/receiving", icon: BoxIcon, countKey: "receiving" },
    ],
  },
  {
    kind: "group",
    label: "Finance",
    icon: CurrencyIcon,
    roles: ["admin", "manager"],
    children: [
      { kind: "item", label: "Income", href: "/dashboard/finance/income", icon: CurrencyIcon },
      { kind: "item", label: "Expenses", href: "/dashboard/finance/expenses", icon: CurrencyIcon },
      { kind: "item", label: "Fixed Assets", href: "/dashboard/finance/fixed-assets", icon: CurrencyIcon },
      { kind: "item", label: "Expense Schedule", href: "/dashboard/finance/expense-schedule", icon: CurrencyIcon },
      { kind: "item", label: "Customer Payment", href: "/dashboard/finance/payments", icon: CurrencyIcon, countKey: "ordersPayment" },
      { kind: "item", label: "Supplier Payment", href: "/dashboard/finance/supplier-payments", icon: CurrencyIcon },
      { kind: "item", label: "Cash Flow", href: "/dashboard/finance/cash-flow", icon: CurrencyIcon },
      { kind: "item", label: "Profit & Loss", href: "/dashboard/finance/profit-loss", icon: CurrencyIcon },
    ],
  },
  {
    kind: "group",
    label: "Accounting",
    icon: LedgerIcon,
    roles: ["admin", "manager"],
    children: [
      { kind: "item", label: "Chart of Accounts", href: "/dashboard/accounting/chart-of-accounts", icon: LedgerIcon },
      {
        kind: "subgroup",
        label: "Financial Settings",
        children: [
          { kind: "item", label: "Bank Accounts", href: "/dashboard/accounting/financial-settings/bank-accounts", icon: LedgerIcon },
          { kind: "item", label: "Payment Methods", href: "/dashboard/accounting/financial-settings/payment-methods", icon: LedgerIcon },
          { kind: "item", label: "Taxes", href: "/dashboard/accounting/financial-settings/taxes", icon: LedgerIcon },
          { kind: "item", label: "Product Account Mapping", href: "/dashboard/accounting/financial-settings/product-mapping", icon: LedgerIcon },
          { kind: "item", label: "Expense Categories", href: "/dashboard/accounting/financial-settings/expense-categories", icon: LedgerIcon },
          { kind: "item", label: "Sales Mapping", href: "/dashboard/accounting/financial-settings/sales-mapping", icon: LedgerIcon },
          { kind: "item", label: "Purchase Mapping", href: "/dashboard/accounting/financial-settings/purchase-mapping", icon: LedgerIcon },
          { kind: "item", label: "Inventory Mapping", href: "/dashboard/accounting/financial-settings/inventory-mapping", icon: LedgerIcon },
        ],
      },
      { kind: "item", label: "Pending Review", href: "/dashboard/accounting/review", icon: LedgerIcon, countKey: "accountingReview" },
      { kind: "item", label: "Journal Entries", href: "/dashboard/accounting/journal", icon: LedgerIcon },
      { kind: "item", label: "Credit Card Payable", href: "/dashboard/accounting/credit-card-payable", icon: LedgerIcon },
      { kind: "item", label: "Trial Balance", href: "/dashboard/accounting/trial-balance", icon: LedgerIcon },
      { kind: "item", label: "Balance Sheet", href: "/dashboard/accounting/balance-sheet", icon: LedgerIcon },
      { kind: "item", label: "Profit & Loss", href: "/dashboard/accounting/income-statement", icon: LedgerIcon },
    ],
  },
  {
    kind: "group",
    label: "Analytics",
    icon: ChartIcon,
    children: [
      { kind: "item", label: "Sales Report", href: "/dashboard/analytics/sales-report", icon: ChartIcon },
      { kind: "item", label: "Inventory Report", href: "/dashboard/analytics/inventory-report", icon: ChartIcon },
      { kind: "item", label: "Production Report", href: "/dashboard/analytics/production-report", icon: ChartIcon },
      { kind: "item", label: "Financial Report", href: "/dashboard/analytics/financial-report", icon: ChartIcon },
    ],
  },
  {
    kind: "group",
    label: "Administration",
    icon: SettingsIcon,
    children: [
      { kind: "item", label: "Users", href: "/dashboard/administration/users", icon: SettingsIcon },
      { kind: "item", label: "Roles", href: "/dashboard/administration/roles", icon: SettingsIcon },
      { kind: "item", label: "Activity Logs", href: "/dashboard/administration/activity-logs", icon: SettingsIcon },
    ],
  },
  {
    kind: "group",
    label: "Account",
    icon: UserIcon,
    children: [
      { kind: "item", label: "Profile", href: "/dashboard/account/profile", icon: UserIcon },
    ],
  },
];

/* ── Icons ──────────────────────────────────────────────────── */
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6.5L8 2l6 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 4.5L8 2 3 4.5v5L8 12l5-2.5v-5z" />
      <path d="M3 4.5l5 2.5 5-2.5M8 7v5" />
    </svg>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L14 5 8 8.5 2 5 8 1.5z" />
      <path d="M2 8l6 3.5L14 8" />
      <path d="M2 11l6 3.5L14 11" />
    </svg>
  );
}

function ShoppingCartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 1h2.5l1.5 8h7l1.5-5.5H4" />
      <circle cx="6.5" cy="12.5" r="1" />
      <circle cx="11.5" cy="12.5" r="1" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="2" width="10" height="13" rx="1" />
      <path d="M6 2a2 2 0 004 0" />
      <path d="M5.5 7h5M5.5 10h3" />
    </svg>
  );
}

function CurrencyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5v7M6 6h3a1.5 1.5 0 010 3H6.5A1.5 1.5 0 005 10.5" />
    </svg>
  );
}

function LedgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="2" width="10" height="12" rx="1" />
      <path d="M6 5h4M6 8h4M6 11h2" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13L6 8l3 3 5-6" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.42 1.42M11.36 11.36l1.42 1.42M3.22 12.78l1.42-1.42M11.36 4.64l1.42-1.42" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="5" r="3" />
      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 5h14M3 10h14M3 15h14" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 12L6 8l4-4" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l4 4 4-4" />
    </svg>
  );
}

/* ── Helpers ────────────────────────────────────────────────── */
function groupContainsActive(group: NavGroup, pathname: string): boolean {
  return group.children.some((child) => {
    if (child.kind === "subgroup") {
      return child.children.some((leaf) => pathname === leaf.href || pathname.startsWith(leaf.href + "/"));
    }
    return pathname === child.href || pathname.startsWith(child.href + "/");
  });
}

function subgroupContainsActive(subgroup: NavSubGroup, pathname: string): boolean {
  return subgroup.children.some((leaf) => pathname === leaf.href || pathname.startsWith(leaf.href + "/"));
}

function isLeafActive(leaf: NavLeaf, pathname: string): boolean {
  if (leaf.href === "/dashboard") return pathname === "/dashboard";
  return pathname === leaf.href || pathname.startsWith(leaf.href + "/");
}

/* ── Breadcrumb ─────────────────────────────────────────────── */
function BreadcrumbHomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6.5L8 2l6 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z" />
    </svg>
  );
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1),
    href: "/" + segments.slice(0, i + 1).join("/"),
  }));

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-(--color-text-muted)">
      <Link href="/dashboard" className="flex items-center text-(--color-text-muted) hover:text-(--color-text) transition-colors">
        <BreadcrumbHomeIcon />
      </Link>
      {crumbs.map((crumb, i) => (
        <React.Fragment key={crumb.href}>
          <span className="text-(--color-border-strong)">/</span>
          {i === crumbs.length - 1 ? (
            <span className="text-(--color-text) font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-(--color-text) transition-colors">
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

/* ── NavItem component ──────────────────────────────────────── */
function NavItemRow({
  leaf,
  active,
  collapsed,
  indent,
  count,
}: {
  leaf: NavLeaf;
  active: boolean;
  collapsed: boolean;
  indent?: boolean;
  count?: number;
}) {
  const Icon = leaf.icon;
  return (
    <Link
      href={leaf.href}
      title={collapsed ? leaf.label : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-(--radius-md) py-2 text-sm font-medium transition-colors",
        indent && !collapsed ? "pl-7 pr-2" : "px-2",
        active
          ? "bg-(--color-primary-light) text-(--color-primary)"
          : "text-(--color-text-muted) hover:bg-(--color-bg) hover:text-(--color-text)",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-(--color-primary)" : "text-(--color-text-subtle)")} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{leaf.label}</span>
          {!!count && (
            <span
              className={cn(
                "inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                active
                  ? "bg-(--color-primary) text-(--color-primary-fg)"
                  : "bg-(--color-border-strong) text-(--color-text-muted)"
              )}
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

/* ── AppShell ───────────────────────────────────────────────── */
interface AppShellProps {
  children: React.ReactNode;
  userEmail: string;
  userRole?: string;
  signOutAction: () => Promise<void>;
  navCounts?: Partial<Record<NavCountKey, number>>;
}

export function AppShell({ children, userEmail, userRole, signOutAction, navCounts }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on route change (tapping a nav link should dismiss it)
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll and allow Escape to dismiss while the mobile drawer is open
  React.useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  // Icon-rail "collapsed" mode only makes visual sense when the aside is in-flow on
  // desktop. Inside the mobile drawer overlay the aside is always full width, so force
  // the expanded rendering there regardless of the desktop collapsed state.
  const effectiveCollapsed = collapsed && !mobileOpen;

  const nav = React.useMemo(
    () => NAV.filter((entry) => entry.kind !== "group" || !entry.roles || entry.roles.includes(userRole ?? "")),
    [userRole]
  );

  // Track which groups are open; auto-open the group that contains the active route
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const entry of NAV) {
      if (entry.kind === "group" && groupContainsActive(entry, pathname)) {
        initial.add(entry.label);
      }
    }
    return initial;
  });

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // Track which subgroups are open; auto-open the subgroup that contains the active route
  const [openSubgroups, setOpenSubgroups] = React.useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const entry of NAV) {
      if (entry.kind !== "group") continue;
      for (const child of entry.children) {
        if (child.kind === "subgroup" && subgroupContainsActive(child, pathname)) {
          initial.add(child.label);
        }
      }
    }
    return initial;
  });

  function toggleSubgroup(label: string) {
    setOpenSubgroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-(--color-bg)">
      {/* ── Mobile drawer backdrop ──────────────────────────── */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 pointer-fine:lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col border-r border-(--color-border) bg-(--color-surface) transition-all duration-200 ease-in-out",
          "fixed inset-y-0 left-0 z-40 w-64 -translate-x-full",
          mobileOpen && "translate-x-0",
          "pointer-fine:lg:static pointer-fine:lg:z-auto pointer-fine:lg:translate-x-0 pointer-fine:lg:shrink-0",
          collapsed ? "pointer-fine:lg:w-14" : "pointer-fine:lg:w-56"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex h-14 items-center gap-3 border-b border-(--color-border) px-4",
          collapsed && "pointer-fine:lg:justify-center pointer-fine:lg:px-3"
        )}>
          <img
            src="/sinag-ukit-logo.jpg"
            alt="Sinag Ukit"
            className="h-8 w-8 shrink-0 rounded-(--radius-md) object-contain"
          />
          {!effectiveCollapsed && (
            <div className="min-w-0 overflow-hidden">
              <p className="truncate text-base font-bold text-(--color-text) leading-tight">Sinag Ukit</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <ul className="flex flex-col gap-0.5">
            {nav.map((entry) => {
              if (entry.kind === "item") {
                return (
                  <li key={entry.href}>
                    <NavItemRow leaf={entry} active={isLeafActive(entry, pathname)} collapsed={effectiveCollapsed} />
                  </li>
                );
              }

              // Group
              const isOpen = openGroups.has(entry.label);
              const hasActive = groupContainsActive(entry, pathname);
              const Icon = entry.icon;

              return (
                <li key={entry.label}>
                  <button
                    onClick={() => !effectiveCollapsed && toggleGroup(entry.label)}
                    title={effectiveCollapsed ? entry.label : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-(--radius-md) px-2 py-2 text-sm font-medium transition-colors",
                      hasActive
                        ? "text-(--color-primary)"
                        : "text-(--color-text-muted) hover:bg-(--color-bg) hover:text-(--color-text)",
                      effectiveCollapsed && "justify-center px-0"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", hasActive ? "text-(--color-primary)" : "text-(--color-text-subtle)")} />
                    {!effectiveCollapsed && (
                      <>
                        <span className="flex-1 text-left">{entry.label}</span>
                        <ChevronDownIcon
                          className={cn(
                            "transition-transform duration-150",
                            isOpen && "rotate-180"
                          )}
                        />
                      </>
                    )}
                  </button>

                  {/* Children — always rendered in collapsed mode (tooltips via title); hidden when group closed */}
                  {(isOpen || effectiveCollapsed) && (
                    <ul className={cn("flex flex-col gap-0.5", !effectiveCollapsed && "mt-0.5")}>
                      {entry.children.map((child) => {
                        if (child.kind === "subgroup") {
                          const isSubOpen = openSubgroups.has(child.label);
                          return (
                            <li key={child.label}>
                              {!effectiveCollapsed && (
                                <button
                                  onClick={() => toggleSubgroup(child.label)}
                                  className="flex w-full items-center gap-1 pl-7 pr-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-(--color-text-subtle) hover:text-(--color-text-muted) transition-colors"
                                >
                                  <span className="flex-1 text-left">{child.label}</span>
                                  <ChevronDownIcon
                                    className={cn("transition-transform duration-150", isSubOpen && "rotate-180")}
                                  />
                                </button>
                              )}
                              {(isSubOpen || effectiveCollapsed) && (
                                <ul className="flex flex-col gap-0.5">
                                  {child.children.map((leaf) => (
                                    <li key={leaf.href}>
                                      <NavItemRow
                                        leaf={leaf}
                                        active={isLeafActive(leaf, pathname)}
                                        collapsed={effectiveCollapsed}
                                        indent
                                        count={leaf.countKey ? navCounts?.[leaf.countKey] : undefined}
                                      />
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          );
                        }
                        return (
                          <li key={child.href}>
                            <NavItemRow
                              leaf={child}
                              active={isLeafActive(child, pathname)}
                              collapsed={effectiveCollapsed}
                              indent
                              count={child.countKey ? navCounts?.[child.countKey] : undefined}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse toggle — desktop-only; mobile drawer is always full width */}
        <div className={cn("hidden border-t border-(--color-border) p-2", collapsed ? "pointer-fine:lg:flex pointer-fine:lg:justify-center" : "pointer-fine:lg:block")}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center gap-2 rounded-(--radius-md) px-2 py-2 text-xs text-(--color-text-muted) hover:bg-(--color-bg) hover:text-(--color-text) transition-colors w-full",
              collapsed && "w-auto justify-center"
            )}
          >
            <ChevronLeftIcon className={cn("transition-transform duration-200", collapsed && "rotate-180")} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-(--color-border) bg-(--color-surface) px-4 shadow-(--shadow-sm)">
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="flex pointer-fine:lg:hidden items-center justify-center h-8 w-8 rounded-(--radius-md) text-(--color-text-muted) hover:bg-(--color-bg) transition-colors"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            <MenuIcon />
          </button>

          <div className="hidden md:block">
            <p className="text-sm font-semibold text-(--color-text)">Sinag Ukit ERP</p>
            <p className="text-xs text-(--color-text-muted)">Enterprise Resource Planning</p>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-(--color-text) leading-tight">{userEmail}</p>
              {userRole && (
                <p className="text-xs text-(--color-text-muted) leading-tight capitalize">{userRole}</p>
              )}
            </div>
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" size="sm" data-testid="sign-out-button">
                Sign out
              </Button>
            </form>
          </div>
        </header>

        {/* Breadcrumb bar */}
        <div className="flex h-10 shrink-0 items-center overflow-x-auto border-b border-(--color-border) bg-(--color-bg) px-4 lg:px-6">
          <Breadcrumb pathname={pathname} />
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
