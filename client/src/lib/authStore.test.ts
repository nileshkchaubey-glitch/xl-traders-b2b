import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase before importing authStore
vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
    })),
  },
}));

import { resolveIsAdmin } from "./authStore";
import type { UserProfile } from "./supabase";

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "user-1",
    email: "test@example.com",
    is_admin: false,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("resolveIsAdmin", () => {
  it("returns true when profile.is_admin is true", () => {
    const profile = makeProfile({ is_admin: true });
    expect(resolveIsAdmin({ email: "random@example.com" }, profile)).toBe(true);
  });

  it("returns false when profile.is_admin is false and email is not in ADMIN_EMAILS", () => {
    const profile = makeProfile({ is_admin: false });
    expect(resolveIsAdmin({ email: "random@example.com" }, profile)).toBe(
      false,
    );
  });

  it("returns true when email matches ADMIN_EMAILS (default: nileshk.chaubey@gmail.com)", () => {
    const profile = makeProfile({ is_admin: false });
    expect(
      resolveIsAdmin({ email: "nileshk.chaubey@gmail.com" }, profile),
    ).toBe(true);
  });

  it("is case-insensitive for email matching", () => {
    const profile = makeProfile({ is_admin: false });
    expect(
      resolveIsAdmin({ email: "Nileshk.Chaubey@Gmail.com" }, profile),
    ).toBe(true);
  });

  it("returns false when user is null", () => {
    expect(resolveIsAdmin(null, null)).toBe(false);
  });

  it("returns false when user.email is null", () => {
    expect(resolveIsAdmin({ email: null }, null)).toBe(false);
  });

  it("returns false when user.email is undefined", () => {
    expect(resolveIsAdmin({ email: undefined }, null)).toBe(false);
  });

  it("returns true with admin profile even when user is null", () => {
    const profile = makeProfile({ is_admin: true });
    expect(resolveIsAdmin(null, profile)).toBe(true);
  });

  it("returns false with non-admin profile and null user", () => {
    const profile = makeProfile({ is_admin: false });
    expect(resolveIsAdmin(null, profile)).toBe(false);
  });
});
