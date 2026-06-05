import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub import.meta.env before importing const module
vi.stubGlobal("window", {
  location: { origin: "https://xl-traders.example.com" },
});

describe("getLoginUrl", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("builds a valid URL with the expected query params", async () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://auth.example.com");
    vi.stubEnv("VITE_APP_ID", "app-123");

    const { getLoginUrl } = await import("./const");
    const url = new URL(getLoginUrl());

    expect(url.origin).toBe("https://auth.example.com");
    expect(url.pathname).toBe("/app-auth");
    expect(url.searchParams.get("appId")).toBe("app-123");
    expect(url.searchParams.get("type")).toBe("signIn");
    expect(url.searchParams.get("redirectUri")).toBe(
      "https://xl-traders.example.com/api/oauth/callback",
    );
  });

  it("encodes the redirect URI as base64 in the state param", async () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://auth.example.com");
    vi.stubEnv("VITE_APP_ID", "app-456");

    const { getLoginUrl } = await import("./const");
    const url = new URL(getLoginUrl());
    const state = url.searchParams.get("state")!;
    const decoded = atob(state);

    expect(decoded).toBe(
      "https://xl-traders.example.com/api/oauth/callback",
    );
  });
});
