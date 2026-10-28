import { useState, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "./provider";
import { useCurrentUser, useCurrentUserState } from "./use-current-user";
import { userInitial, userLabel } from "./user";

/**
 * Auth state components — plain wrappers around the Identity session.
 * While the session resolves, gates that care about signed-out state render
 * nothing so there is no signed-out flash on a hard reload.
 */

/** Where `RedirectToSignIn` sends signed-out visitors. */
export const SIGN_IN_PATH = "/login";

/** Render children only when a user is present. */
export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? <>{children}</> : null;
}

/**
 * Render children only once we KNOW the visitor is signed out (`isPending` has
 * cleared and there is no user). Hidden while the session is still loading.
 */
export function SignedOut({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return <>{children}</>;
}

/** Client-side redirect to the sign-in route. */
export function RedirectToSignIn() {
  return <Navigate to={SIGN_IN_PATH} />;
}

/**
 * Signed-in identity chip + sign-out. Restyle freely (see the design-ui
 * skill). Sign-out is only shown when someone is signed in.
 */
export function UserButton() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  const label = userLabel(user);

  const onSignOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
    } catch {
      setError("Could not sign out. Try again.");
      setSigningOut(false);
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {user.profileImageUrl ? (
        <img
          src={user.profileImageUrl}
          alt=""
          className="size-8 shrink-0 rounded-full object-cover ring-1 ring-border"
        />
      ) : (
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground ring-1 ring-border">
          {userInitial(user)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {user.primaryEmail && user.primaryEmail !== label ? (
          <span className="block truncate text-xs text-muted-foreground">{user.primaryEmail}</span>
        ) : null}
        {error ? (
          <span role="alert" className="block text-xs text-destructive">
            {error}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        disabled={signingOut}
        onClick={() => void onSignOut()}
        className="shrink-0 cursor-pointer rounded-sm px-1.5 py-1 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait disabled:no-underline"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
