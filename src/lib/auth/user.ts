import type { User } from "@netlify/identity";

/** Normalized user shape used across the app. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
};

/** Map a Netlify Identity user onto the app's smaller, stable shape. */
export function toAppUser(user: User): AppUser {
  const metadataName =
    typeof user.userMetadata?.full_name === "string"
      ? user.userMetadata.full_name
      : typeof user.userMetadata?.name === "string"
        ? user.userMetadata.name
        : null;

  return {
    id: user.id,
    displayName: user.name ?? metadataName ?? user.email ?? null,
    primaryEmail: user.email ?? null,
    profileImageUrl: user.pictureUrl ?? null,
  };
}

/** Best human label for a user, used by avatars and sign-out UI. */
export function userLabel(user: AppUser): string {
  return user.displayName ?? user.primaryEmail ?? "Account";
}

/** First letter for the avatar fallback. */
export function userInitial(user: AppUser): string {
  return userLabel(user).charAt(0).toUpperCase();
}
