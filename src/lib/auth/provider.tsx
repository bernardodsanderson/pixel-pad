import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AUTH_EVENTS,
  getUser,
  handleAuthCallback,
  logout,
  onAuthChange,
  type CallbackResult,
  type User,
} from "@netlify/identity";
import { toAppUser, type AppUser } from "./user";

type AuthContextValue = {
  /** The signed-in user, or null while loading and when signed out. */
  user: AppUser | null;
  /** True until the first session lookup finishes. */
  isPending: boolean;
  /** The last callback result, useful for post-confirmation copy. */
  lastCallback: CallbackResult["type"] | null;
  /** Re-read the session from Identity. */
  refresh: () => Promise<AppUser | null>;
  /** End the session. Resolves even if the network call fails. */
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Process an email confirmation / recovery / invite hash exactly once per page
 * load, even under React StrictMode's double-mounted effects. `handleAuthCallback`
 * consumes the token in the URL, so a second call is harmless but noisy.
 */
let callbackPromise: Promise<CallbackResult | null> | null = null;
function processAuthCallbackOnce(): Promise<CallbackResult | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  callbackPromise ??= handleAuthCallback().catch((error) => {
    console.warn("[auth] callback could not be processed", error);
    return null;
  });
  return callbackPromise;
}

function clearAuthHash(): void {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
}

/**
 * Netlify Identity session provider, mounted once in the root route.
 *
 * Browser-only by construction: Identity derives its endpoint from
 * `window.location.origin`, so the effects below never run during the SPA
 * prerender. The server-rendered shell therefore paints the signed-out header
 * skeleton and hydrates without a mismatch.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [lastCallback, setLastCallback] = useState<CallbackResult["type"] | null>(null);

  const applyUser = useCallback((next: User | null) => {
    setUser(next ? toAppUser(next) : null);
    setIsPending(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await getUser();
      applyUser(next);
      return next ? toAppUser(next) : null;
    } catch (error) {
      console.warn("[auth] could not read session", error);
      applyUser(null);
      return null;
    }
  }, [applyUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let active = true;

    void (async () => {
      const callback = await processAuthCallbackOnce();
      if (!active) return;

      if (callback) {
        setLastCallback(callback.type);
        clearAuthHash();
        if (callback.type === "recovery") {
          // The recovery link signs the user in but they still need a new
          // password. A hard navigation keeps the provider out of the form.
          window.location.replace("/reset-password");
          return;
        }
      }

      const next = await getUser().catch(() => null);
      if (!active) return;
      applyUser(next);
    })();

    const unsubscribe = onAuthChange((event, next) => {
      if (!active) return;
      if (event === AUTH_EVENTS.LOGOUT) applyUser(null);
      else applyUser(next);
      setIsPending(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [applyUser]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      // Identity clears its cookies even when the revoke call fails; the local
      // session must still look signed out so the UI doesn't strand the user.
      console.warn("[auth] sign-out request failed", error);
    } finally {
      applyUser(null);
    }
  }, [applyUser]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isPending, lastCallback, refresh, signOut }),
    [user, isPending, lastCallback, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// The hook intentionally lives beside its provider so the context stays
// private. It is not a Fast Refresh boundary in practice.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
