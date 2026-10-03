import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, navigate } = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: false, isAdmin: false },
  navigate: vi.fn(),
}));
vi.mock("@/lib/authStore", () => ({ useAuthStore: () => auth }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/productService", () => ({
  storageService: { uploadCategoryImage: vi.fn() },
  categoryService: {}, productService: {}, productImageService: {},
}));
vi.mock("wouter", async importOriginal => ({
  ...(await importOriginal<typeof import("wouter")>()),
  useLocation: () => ["/admin", navigate],
  useSearch: () => "",
  Redirect: ({ to, replace }: { to: string; replace?: boolean }) => {
    navigate(to, { replace });
    return null;
  },
}));

import AdminDashboard from "./AdminDashboard";
import AdminProductEditor from "./AdminProductEditor";
import AdminAccess from "@/components/admin/AdminAccess";

afterEach(() => vi.unstubAllGlobals());

describe.each([
  ["dashboard", AdminDashboard],
  ["product editor", AdminProductEditor],
] as const)("%s access", (_, Page) => {
  beforeEach(() => {
    Object.assign(auth, { isLoading: false, isAuthenticated: false, isAdmin: false });
    vi.clearAllMocks();
    vi.stubGlobal("sessionStorage", { getItem: () => null });
  });

  it("redirects a customer without mounting admin controls or refreshing the profile", () => {
    auth.isAuthenticated = true;
    expect(renderToStaticMarkup(<Page />)).toBe("");
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("redirects a guest to sign-in", () => {
    expect(renderToStaticMarkup(<Page />)).toBe("");
    expect(navigate).toHaveBeenCalledWith("/auth", { replace: true });
  });

  it("ignores a stale admin flag without an authenticated session", () => {
    auth.isAdmin = true;
    expect(renderToStaticMarkup(<Page />)).toBe("");
    expect(navigate).toHaveBeenCalledWith("/auth", { replace: true });
  });

  it("waits without redirecting while the database-backed profile is loading", () => {
    Object.assign(auth, { isLoading: true, isAuthenticated: true, isAdmin: true });
    expect(renderToStaticMarkup(<Page />)).toContain('role="status"');
    expect(navigate).not.toHaveBeenCalled();
  });
});

it("mounts protected content for a resolved, authenticated database admin", () => {
  Object.assign(auth, { isLoading: false, isAuthenticated: true, isAdmin: true });
  const Content = vi.fn(() => <button>Admin controls</button>);
  expect(renderToStaticMarkup(<AdminAccess><Content /></AdminAccess>)).toContain("Admin controls");
  expect(Content).toHaveBeenCalledOnce();
});

it("stops mounting protected content after the database admin flag is revoked", () => {
  Object.assign(auth, { isLoading: false, isAuthenticated: true, isAdmin: true });
  const Content = vi.fn(() => <button>Admin controls</button>);
  renderToStaticMarkup(<AdminAccess><Content /></AdminAccess>);
  Content.mockClear();
  auth.isAdmin = false;
  expect(renderToStaticMarkup(<AdminAccess><Content /></AdminAccess>)).toBe("");
  expect(Content).not.toHaveBeenCalled();
});
