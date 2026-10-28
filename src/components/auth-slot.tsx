import { Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { userInitial, userLabel } from "@/lib/auth/user";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AuthSlot({ onOpenLibrary }: { onOpenLibrary?: () => void }) {
  const { user, isPending } = useCurrentUserState();

  // Reserve the same footprint while Identity resolves so the header does not
  // jump from "Sign in" to an avatar after hydration.
  if (isPending) {
    return (
      <span
        className="size-9 shrink-0 animate-pulse rounded-full bg-secondary ring-1 ring-border"
        aria-hidden="true"
      />
    );
  }

  if (!user) {
    return (
      <Button variant="outline" size="sm" className="h-11 px-3 sm:h-9" asChild>
        <Link to="/login">Sign in</Link>
      </Button>
    );
  }

  const label = userLabel(user);

  return (
    <button
      type="button"
      onClick={onOpenLibrary}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full",
        "ring-1 ring-border transition-transform duration-150 ease-out",
        "hover:ring-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        "active:scale-[0.96]",
      )}
      aria-label={`${label} — saved sprites`}
    >
      {user.profileImageUrl ? (
        <img src={user.profileImageUrl} alt="" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center bg-secondary text-xs font-medium text-secondary-foreground">
          {userInitial(user)}
        </span>
      )}
    </button>
  );
}
