"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

/* ── Nav items ──────────────────────────────────────────────── */
const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Sales", href: "/dashboard/sales" },
  { label: "Inventory", href: "/dashboard/inventory" },
  { label: "Incoming", href: "/dashboard/incoming" },
] as const;

/* ── Icons (inline SVG — no extra dependency) ───────────────── */
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

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6.5L8 2l6 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z" />
    </svg>
  );
}

/* ── Breadcrumb ─────────────────────────────────────────────── */
function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1),
    href: "/" + segments.slice(0, i + 1).join("/"),
  }));

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-[--color-text-muted]">
      <Link href="/dashboard" className="flex items-center text-[--color-text-muted] hover:text-[--color-text] transition-colors">
        <HomeIcon />
      </Link>
      {crumbs.map((crumb, i) => (
        <React.Fragment key={crumb.href}>
          <span className="text-[--color-border-strong]">/</span>
          {i === crumbs.length - 1 ? (
            <span className="text-[--color-text] font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-[--color-text] transition-colors">
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

/* ── AppShell ───────────────────────────────────────────────── */
interface AppShellProps {
  children: React.ReactNode;
  userEmail: string;
  userRole?: string;
  /** Server action for signing out — passed as form action */
  signOutAction: () => Promise<void>;
}

export function AppShell({ children, userEmail, userRole, signOutAction }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-[--color-bg]">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col shrink-0 border-r border-[--color-border] bg-[--color-surface] transition-all duration-200 ease-in-out",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo / App title */}
        <div className={cn(
          "flex items-center border-b border-[--color-border]",
          collapsed ? "h-14 justify-center px-3" : "h-14 gap-3 px-4"
        )}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[--radius-md] bg-[--color-primary] text-white font-bold text-sm select-none">
            SU
          </div>
          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <p className="truncate text-sm font-semibold text-[--color-text] leading-tight">Sinag Ukit BMS</p>
              <p className="truncate text-xs text-[--color-text-muted] leading-tight">Business Management</p>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <ul className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[--radius-md] px-2 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-[--color-primary-light] text-[--color-primary]"
                        : "text-[--color-text-muted] hover:bg-[--color-bg] hover:text-[--color-text]",
                      collapsed && "justify-center px-0"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[11px] font-bold border",
                        active
                          ? "border-[--color-primary] text-[--color-primary]"
                          : "border-[--color-border] text-[--color-text-subtle]"
                      )}
                    >
                      {item.label[0]}
                    </span>
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse toggle */}
        <div className={cn("border-t border-[--color-border] p-2", collapsed && "flex justify-center")}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center gap-2 rounded-[--radius-md] px-2 py-2 text-xs text-[--color-text-muted] hover:bg-[--color-bg] hover:text-[--color-text] transition-colors w-full",
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
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[--color-border] bg-[--color-surface] px-4 shadow-[--shadow-sm]">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex md:hidden items-center justify-center h-8 w-8 rounded-[--radius-md] text-[--color-text-muted] hover:bg-[--color-bg] transition-colors"
            aria-label="Toggle sidebar"
          >
            <MenuIcon />
          </button>

          <div className="hidden md:block">
            <p className="text-sm font-semibold text-[--color-text]">Sinag Ukit BMS</p>
            <p className="text-xs text-[--color-text-muted]">Business Management System</p>
          </div>

          {/* User info + sign out */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-[--color-text] leading-tight">{userEmail}</p>
              {userRole && (
                <p className="text-xs text-[--color-text-muted] leading-tight capitalize">{userRole}</p>
              )}
            </div>
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </header>

        {/* Breadcrumb bar */}
        <div className="flex h-10 shrink-0 items-center border-b border-[--color-border] bg-[--color-bg] px-6">
          <Breadcrumb pathname={pathname} />
        </div>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
