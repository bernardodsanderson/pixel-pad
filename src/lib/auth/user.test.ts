import { describe, expect, it } from "vitest";
import type { User } from "@netlify/identity";
import { toAppUser, userInitial, userLabel } from "./user";

function identityUser(overrides: Partial<User> = {}): User {
  return { id: "user-1", ...overrides } as User;
}

describe("toAppUser", () => {
  it("prefers the display name", () => {
    const user = toAppUser(
      identityUser({
        name: "Ada Lovelace",
        email: "ada@example.com",
        userMetadata: { full_name: "Metadata Name" },
      }),
    );
    expect(user.displayName).toBe("Ada Lovelace");
    expect(user.primaryEmail).toBe("ada@example.com");
  });

  it("falls back to user_metadata.full_name", () => {
    const user = toAppUser(identityUser({ userMetadata: { full_name: "Grace Hopper" } }));
    expect(user.displayName).toBe("Grace Hopper");
  });

  it("falls back to user_metadata.name", () => {
    const user = toAppUser(identityUser({ userMetadata: { name: "Katherine Johnson" } }));
    expect(user.displayName).toBe("Katherine Johnson");
  });

  it("falls back to the email", () => {
    const user = toAppUser(identityUser({ email: "person@example.com" }));
    expect(user.displayName).toBe("person@example.com");
  });

  it("ends up with null when nothing identifies the user", () => {
    const user = toAppUser(identityUser());
    expect(user.displayName).toBeNull();
    expect(user.primaryEmail).toBeNull();
    expect(user.profileImageUrl).toBeNull();
  });

  it("copies the avatar URL", () => {
    const user = toAppUser(identityUser({ pictureUrl: "https://example.com/avatar.png" }));
    expect(user.profileImageUrl).toBe("https://example.com/avatar.png");
  });

  it("ignores non-string metadata values", () => {
    const user = toAppUser(identityUser({ userMetadata: { full_name: 42, name: "Ok" } }));
    expect(user.displayName).toBe("Ok");
  });
});

describe("userLabel", () => {
  it("uses the display name", () => {
    expect(
      userLabel({
        id: "1",
        displayName: "Ada",
        primaryEmail: "ada@example.com",
        profileImageUrl: null,
      }),
    ).toBe("Ada");
  });

  it("falls back to the email", () => {
    expect(
      userLabel({
        id: "1",
        displayName: null,
        primaryEmail: "ada@example.com",
        profileImageUrl: null,
      }),
    ).toBe("ada@example.com");
  });

  it("falls back to Account", () => {
    expect(
      userLabel({ id: "1", displayName: null, primaryEmail: null, profileImageUrl: null }),
    ).toBe("Account");
  });
});

describe("userInitial", () => {
  it("returns the first letter, uppercased", () => {
    expect(
      userInitial({
        id: "1",
        displayName: "ada",
        primaryEmail: null,
        profileImageUrl: null,
      }),
    ).toBe("A");
  });

  it("uses the email when there is no display name", () => {
    expect(
      userInitial({
        id: "1",
        displayName: null,
        primaryEmail: "zoe@example.com",
        profileImageUrl: null,
      }),
    ).toBe("Z");
  });
});
