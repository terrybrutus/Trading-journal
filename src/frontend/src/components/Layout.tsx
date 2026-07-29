import { UniversalMic } from "@/components/UniversalMic";
import { useAuth } from "@/hooks/useAuth";
import { UniversalMicProvider } from "@/hooks/useUniversalMic";
import { cn } from "@/lib/utils";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Menu,
  PlusCircle,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  protected: boolean;
  ocid: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    to: "/",
    icon: LayoutDashboard,
    protected: false,
    ocid: "nav.dashboard",
  },
  {
    label: "Journal",
    to: "/journal",
    icon: BookOpen,
    protected: true,
    ocid: "nav.journal",
  },
  {
    label: "New Trade",
    to: "/trades/new",
    icon: PlusCircle,
    protected: true,
    ocid: "nav.new_trade",
  },
  {
    label: "Analytics",
    to: "/analytics",
    icon: BarChart3,
    protected: true,
    ocid: "nav.analytics",
  },
  {
    label: "Settings",
    to: "/settings",
    icon: SettingsIcon,
    protected: true,
    ocid: "nav.settings",
  },
];

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { location } = useRouterState();

  // Close the mobile drawer on navigation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — close drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <UniversalMicProvider>
      <div className="bg-background text-foreground min-h-screen font-body">
        <div className="flex min-h-screen">
          {/* Desktop sidebar */}
          <Sidebar />

          {/* Mobile drawer */}
          {mobileOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                type="button"
                data-ocid="nav.mobile_overlay"
                className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              />
              <div className="absolute left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border shadow-elevated animate-fade-in">
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          )}

          {/* Main column */}
          <div className="flex min-w-0 flex-1 flex-col">
            <Header onOpenMobile={() => setMobileOpen(true)} />
            <main className="bg-background flex-1 overflow-x-hidden">
              <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
                <Outlet />
              </div>
            </main>
            <Footer />
          </div>
        </div>

        {/* One universal mic for the whole app. Only visible on form pages
            that register a field sink (New Trade / Journal entry). */}
        <UniversalMic />
      </div>
    </UniversalMicProvider>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { location } = useRouterState();
  return (
    <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 flex-col border-r border-sidebar-border lg:flex">
      <SidebarContent onNavigate={onNavigate} currentPath={location.pathname} />
    </aside>
  );
}

function SidebarContent({
  onNavigate,
  currentPath,
}: {
  onNavigate?: () => void;
  currentPath: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <Brand />
      <nav className="flex-1 px-3 py-4" aria-label="Primary">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                item={item}
                currentPath={currentPath}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      </nav>
      <SidebarFooter />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
      <div className="bg-gradient-primary size-7 rounded-md shadow-subtle" />
      <div className="font-display text-lg font-semibold tracking-tight">
        QUANTUM
      </div>
      <span className="text-muted-foreground ml-auto font-mono text-[10px] uppercase tracking-widest">
        Journal
      </span>
    </div>
  );
}

function NavLink({
  item,
  currentPath,
  onNavigate,
}: {
  item: NavItem;
  currentPath: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  // Treat "/" as exact match; other routes match by prefix so detail pages
  // highlight their parent nav item.
  const active =
    item.to === "/"
      ? currentPath === "/"
      : currentPath === item.to || currentPath.startsWith(`${item.to}/`);
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      data-ocid={item.ocid}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-smooth",
        active
          ? "bg-sidebar-accent text-sidebar-foreground shadow-subtle"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-smooth",
          active
            ? "text-primary"
            : "text-muted-foreground group-hover:text-sidebar-foreground",
        )}
      />
      <span>{item.label}</span>
    </Link>
  );
}

function SidebarFooter() {
  const { isAuthenticated, principal } = useAuth();
  return (
    <div className="border-t border-sidebar-border px-4 py-3">
      {isAuthenticated && principal ? (
        <div className="space-y-0.5">
          <div className="text-muted-foreground text-[10px] uppercase tracking-widest">
            Signed in
          </div>
          <div className="font-mono text-xs text-sidebar-foreground truncate">
            {principal}
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground text-xs">Not signed in</div>
      )}
    </div>
  );
}

function Header({ onOpenMobile }: { onOpenMobile: () => void }) {
  return (
    <header className="bg-card border-b border-border shadow-subtle sticky top-0 z-30">
      <div className="flex h-16 items-center gap-3 px-4 md:px-8">
        <button
          type="button"
          data-ocid="nav.mobile_menu_button"
          onClick={onOpenMobile}
          className="text-muted-foreground hover:text-foreground transition-smooth rounded-md p-2 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>
        <HeaderTitle />
        <div className="ml-auto flex items-center gap-3">
          <AuthBadge />
        </div>
      </div>
    </header>
  );
}

function HeaderTitle() {
  const { location } = useRouterState();
  const title = routeTitle(location.pathname);
  return (
    <h1 className="font-display text-base font-semibold tracking-tight md:text-lg">
      {title}
    </h1>
  );
}

function routeTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/journal") return "Trade Journal";
  if (pathname === "/trades/new") return "New Trade";
  if (pathname.startsWith("/trades/")) return "Trade Detail";
  if (pathname === "/analytics") return "Bias Analytics";
  if (pathname === "/settings") return "Settings";
  return "QUANTUM";
}

function AuthBadge() {
  const { isAuthenticated, login, logout, isLoggingIn } = useAuth();
  if (isAuthenticated) {
    return (
      <button
        type="button"
        data-ocid="auth.signout_button"
        onClick={logout}
        className="text-muted-foreground hover:text-foreground transition-smooth rounded-md border border-border px-3 py-1.5 text-xs font-medium"
      >
        Sign out
      </button>
    );
  }
  return (
    <button
      type="button"
      data-ocid="auth.signin_button"
      onClick={login}
      disabled={isLoggingIn}
      className="bg-primary text-primary-foreground hover:bg-primary/90 transition-smooth rounded-md px-3.5 py-1.5 text-xs font-medium shadow-xs disabled:opacity-60"
    >
      {isLoggingIn ? "Connecting…" : "Sign in"}
    </button>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  const href = `https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
    typeof window !== "undefined" ? window.location.hostname : "quantum",
  )}`;
  return (
    <footer className="bg-card border-t border-border px-4 py-4 md:px-8">
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span className="font-mono">
          © {year}. Built with love using{" "}
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            caffeine.ai
          </a>
        </span>
        <span className="hidden sm:inline">QUANTUM Trading Journal</span>
      </div>
    </footer>
  );
}
