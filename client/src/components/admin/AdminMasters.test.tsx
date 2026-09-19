import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";

const { auth, navigate } = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: false,
    isAdmin: false,
    user: null,
    signOut: vi.fn(),
  },
  navigate: vi.fn(),
}));

vi.mock("@/lib/authStore", () => ({ useAuthStore: () => auth }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("wouter", async importOriginal => ({
  ...(await importOriginal<typeof import("wouter")>()),
  useLocation: () => ["/admin/masters", navigate],
  Redirect: ({ to, replace }: { to: string; replace?: boolean }) => {
    navigate(to, { replace });
    return null;
  },
}));

import AdminMasters from "./AdminMasters";

describe("AdminMasters access", () => {
  beforeEach(() => {
    Object.assign(auth, {
      isLoading: false,
      isAuthenticated: false,
      isAdmin: false,
    });
    vi.clearAllMocks();
  });

  it("waits for authentication without mounting admin controls or redirecting", () => {
    Object.assign(auth, { isLoading: true, isAuthenticated: true, isAdmin: true });
    const html = renderToStaticMarkup(<AdminMasters />);
    expect(html).toContain('role="status"');
    expect(html).not.toContain("New Master");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("redirects a guest to sign-in without mounting the page", () => {
    expect(renderToStaticMarkup(<AdminMasters />)).toBe("");
    expect(navigate).toHaveBeenCalledWith("/auth", { replace: true });
  });

  it("redirects a customer to the storefront without mounting the page", () => {
    auth.isAuthenticated = true;
    expect(renderToStaticMarkup(<AdminMasters />)).toBe("");
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("requires authentication even if a stale admin flag remains", () => {
    auth.isAdmin = true;
    expect(renderToStaticMarkup(<AdminMasters />)).toBe("");
    expect(navigate).toHaveBeenCalledWith("/auth", { replace: true });
  });

  it("mounts the masters controls for an authenticated admin", () => {
    Object.assign(auth, { isAuthenticated: true, isAdmin: true });
    expect(
      renderToStaticMarkup(
        <Router ssrPath="/admin/masters">
          <AdminMasters />
        </Router>
      )
    ).toContain("New Master");
    expect(navigate).not.toHaveBeenCalled();
  });
});
