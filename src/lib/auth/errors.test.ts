import { describe, expect, it } from "vitest";
import { AuthError, MissingIdentityError } from "@netlify/identity";
import { describeAuthError } from "./errors";

describe("describeAuthError", () => {
  it("explains that sign-in needs the deployed site", () => {
    expect(describeAuthError(new MissingIdentityError())).toBe(
      "Sign-in isn’t available here. Open the deployed site to use your account.",
    );
  });

  it("asks the visitor to slow down on 429", () => {
    expect(describeAuthError(new AuthError("Too Many Requests", 429))).toBe(
      "Too many attempts. Wait a minute, then try again.",
    );
  });

  it("asks the visitor to slow down when the copy mentions too many", () => {
    expect(describeAuthError(new AuthError("Too many login attempts"))).toBe(
      "Too many attempts. Wait a minute, then try again.",
    );
  });

  it("explains email confirmation", () => {
    expect(describeAuthError(new AuthError("Email not confirmed"))).toBe(
      "Confirm your email first — check your inbox for the verification link.",
    );
  });

  it("explains unverified accounts", () => {
    expect(describeAuthError(new AuthError("User is not verified"))).toBe(
      "Confirm your email first — check your inbox for the verification link.",
    );
  });

  it("explains invalid credentials", () => {
    expect(describeAuthError(new AuthError("Invalid login credentials", 401))).toBe(
      "That email and password don’t match. Try again.",
    );
  });

  it("explains an existing account", () => {
    expect(describeAuthError(new AuthError("User already registered", 422))).toBe(
      "That email already has an account. Sign in instead.",
    );
  });

  it("asks for valid details on 422", () => {
    expect(describeAuthError(new AuthError("Unprocessable entity", 422))).toBe(
      "Check the email and password — one of them isn’t valid.",
    );
  });

  it("asks for valid details on 400", () => {
    expect(describeAuthError(new AuthError("Bad request", 400))).toBe(
      "Check the email and password — one of them isn’t valid.",
    );
  });

  it("does not leak the raw message on 401", () => {
    expect(describeAuthError(new AuthError("Unauthorized", 401))).toBe(
      "We couldn’t sign you in with those details.",
    );
  });

  it("explains server failures", () => {
    expect(describeAuthError(new AuthError("Internal server error", 500))).toBe(
      "The sign-in service is having trouble. Try again in a moment.",
    );
  });

  it("falls back to the raw message when there is no status", () => {
    expect(describeAuthError(new AuthError("Something specific"))).toBe("Something specific");
  });

  it("falls back to a generic message for an empty error", () => {
    expect(describeAuthError(new AuthError(""))).toBe("Something went wrong. Try again.");
  });

  it("explains network failures", () => {
    for (const message of [
      "Failed to fetch",
      "NetworkError when attempting to fetch resource",
      "You are offline",
      "Load failed",
    ]) {
      expect(describeAuthError(new Error(message))).toBe(
        "Can’t reach the sign-in service. Check your connection and try again.",
      );
    }
  });

  it("passes through other Error messages", () => {
    expect(describeAuthError(new Error("Custom failure"))).toBe("Custom failure");
  });

  it("handles non-Error values", () => {
    expect(describeAuthError("a string")).toBe("Something went wrong. Try again.");
    expect(describeAuthError(null)).toBe("Something went wrong. Try again.");
    expect(describeAuthError(undefined)).toBe("Something went wrong. Try again.");
  });
});
