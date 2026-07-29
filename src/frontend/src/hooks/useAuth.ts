import { useInternetIdentity } from "@caffeineai/core-infrastructure";

/**
 * Thin wrapper around `useInternetIdentity` that exposes the fields the
 * app shell actually needs. Pages and routes import from here so they
 * don't couple directly to the core-infrastructure package.
 */
export function useAuth() {
  const {
    identity,
    login,
    clear,
    loginStatus,
    isInitializing,
    isLoggingIn,
    isLoginError,
    isAuthenticated,
    loginError,
  } = useInternetIdentity();

  return {
    /** The II principal's textual id, when authenticated. */
    principal: identity?.getPrincipal().toText(),
    identity,
    login,
    logout: clear,
    loginStatus,
    isInitializing,
    isLoggingIn,
    isLoginError,
    isAuthenticated,
    loginError,
  };
}
