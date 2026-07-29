import { useAuth } from "@/hooks/useAuth";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Gate for protected routes. While II is initializing we show a minimal
 * loading state; once idle and unauthenticated we redirect to the
 * dashboard (which renders a sign-in prompt). Authenticated children
 * render directly.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isInitializing, isAuthenticated } = useAuth();

  if (isInitializing) {
    return (
      <div
        data-ocid="auth.loading_state"
        className="flex min-h-[60vh] items-center justify-center"
      >
        <div className="text-muted-foreground font-mono text-sm animate-pulse-subtle">
          Restoring session…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        data-ocid="auth.signin_prompt"
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center"
      >
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Sign in required
          </h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            Connect Internet Identity to access your trade journal and bias
            analytics.
          </p>
        </div>
        <SignInButton />
        <Link
          to="/"
          className="text-muted-foreground text-xs hover:text-foreground transition-smooth"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  // eslint-disable-next-line react/jsx/no-useless-fragment
  return <>{children}</>;
}

function SignInButton() {
  const { login, isLoggingIn } = useInternetIdentity();
  return (
    <button
      type="button"
      data-ocid="auth.signin_button"
      onClick={login}
      disabled={isLoggingIn}
      className="bg-primary text-primary-foreground hover:bg-primary/90 transition-smooth rounded-md px-5 py-2.5 text-sm font-medium shadow-xs disabled:opacity-60"
    >
      {isLoggingIn ? "Connecting…" : "Connect Internet Identity"}
    </button>
  );
}
