import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import { Analytics } from "@/pages/Analytics";
import { Dashboard } from "@/pages/Dashboard";
import { Journal } from "@/pages/Journal";
import { NewTrade } from "@/pages/NewTrade";
import { NotFound } from "@/pages/NotFound";
import { Settings } from "@/pages/Settings";
import { TradeDetail } from "@/pages/TradeDetail";
import { DEFAULT_JOURNAL_SEARCH, type JournalSearch } from "@/types";
import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

// The root route renders the shared Layout shell. Layout owns its own
// <Outlet /> in the main content area, so child routes render there.
const rootRoute = createRootRoute({
  component: () => <Layout />,
});

// Public landing route — the dashboard renders a sign-in prompt for
// unauthenticated visitors and a summary view once authenticated.
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard,
});

// Journal search — every field is optional and URL-serializable so views
// are shareable and survive refresh. `validateSearch` merges defaults so
// downstream consumers always see a complete `JournalSearch`.
const journalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/journal",
  validateSearch: (search: Record<string, unknown>): JournalSearch => ({
    ...DEFAULT_JOURNAL_SEARCH,
    ...(search as Partial<JournalSearch>),
  }),
  component: () => (
    <RequireAuth>
      <Journal />
    </RequireAuth>
  ),
});

const newTradeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/trades/new",
  component: () => (
    <RequireAuth>
      <NewTrade />
    </RequireAuth>
  ),
});

const tradeDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/trades/$tradeId",
  component: () => (
    <RequireAuth>
      <TradeDetail />
    </RequireAuth>
  ),
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analytics",
  component: () => (
    <RequireAuth>
      <Analytics />
    </RequireAuth>
  ),
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: () => (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  ),
});

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  component: NotFound,
});

export const routeTree = rootRoute.addChildren([
  dashboardRoute,
  journalRoute,
  newTradeRoute,
  tradeDetailRoute,
  analyticsRoute,
  settingsRoute,
  notFoundRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
