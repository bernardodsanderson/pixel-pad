import { AuthError, MissingIdentityError } from "@netlify/identity";

/**
 * Turn Netlify Identity / GoTrue errors into copy a person can act on.
 * The raw messages are inconsistent ("401 Unauthorized", "Invalid login
 * credentials", "Email not confirmed"), so match on status first, then text.
 */
export function describeAuthError(error: unknown): string {
  if (error instanceof MissingIdentityError) {
    return "Sign-in isn’t available here. Open the deployed site to use your account.";
  }

  if (error instanceof AuthError) {
    const message = error.message.toLowerCase();
    if (error.status === 429 || message.includes("too many")) {
      return "Too many attempts. Wait a minute, then try again.";
    }
    if (message.includes("confirm") || message.includes("verified")) {
      return "Confirm your email first — check your inbox for the verification link.";
    }
    if (
      message.includes("invalid") &&
      (message.includes("password") || message.includes("credential") || message.includes("login"))
    ) {
      return "That email and password don’t match. Try again.";
    }
    if (
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("exists")
    ) {
      return "That email already has an account. Sign in instead.";
    }
    if (error.status === 422 || error.status === 400) {
      return "Check the email and password — one of them isn’t valid.";
    }
    if (error.status === 401) {
      return "We couldn’t sign you in with those details.";
    }
    if (error.status && error.status >= 500) {
      return "The sign-in service is having trouble. Try again in a moment.";
    }
    return error.message || "Something went wrong. Try again.";
  }

  if (error instanceof Error) {
    if (/failed to fetch|network|offline|load failed/i.test(error.message)) {
      return "Can’t reach the sign-in service. Check your connection and try again.";
    }
    return error.message;
  }

  return "Something went wrong. Try again.";
}
