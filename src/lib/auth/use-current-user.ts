import { useAuth } from "./provider";
import type { AppUser } from "./user";

export type { AppUser } from "./user";

/** Current user plus the session-loading flag. */
export type CurrentUserState = {
  /** The user — `null` BOTH while the session loads and when signed out. */
  user: AppUser | null;
  /** True while the session is still resolving — don't treat `user: null` as signed out yet. */
  isPending: boolean;
};

/**
 * Current user + loading state. Same behavior everywhere: Netlify Identity
 * resolves the session in the browser after the shell hydrates.
 *
 * Guard routes by waiting out `isPending` before acting on `user` — redirecting
 * on `user: null` alone bounces signed-in visitors to sign-in on every reload:
 *
 *   const { user, isPending } = useCurrentUserState();
 *   if (isPending) return null;
 *   if (!user) return <RedirectToSignIn />;
 */
export function useCurrentUserState(): CurrentUserState {
  const { user, isPending } = useAuth();
  return { user, isPending };
}

/**
 * Convenience view for display (e.g. `user?.displayName ?? "Guest"`). NOTE:
 * `null` means *loading OR signed out* — for redirects/guards use
 * `useCurrentUserState()` and check `isPending`.
 */
export function useCurrentUser(): AppUser | null {
  return useAuth().user;
}
