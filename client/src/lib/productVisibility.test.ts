import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const { from, getSession, query, rows, filters } = vi.hoisted(() => ({
  from: vi.fn(),
  getSession: vi.fn(),
  query: { select: vi.fn(), eq: vi.fn(), single: vi.fn() },
  rows: [
    { id: "active", status: "published", is_active: true },
    { id: "inactive", status: "published", is_active: false },
    { id: "draft", status: "draft", is_active: false },
  ],
  filters: [] as [string, unknown][],
}));
vi.mock("./supabase", () => ({ supabase: { auth: { getSession }, from } }));
import { productService, invalidateSessionCache } from "./productService";
beforeEach(() => {
  vi.resetAllMocks();
  filters.length = 0;
  invalidateSessionCache();
  getSession.mockResolvedValue({
    data: { session: { user: { id: "admin" } } },
  });
  from.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.eq.mockImplementation((key, value) => {
    filters.push([key, value]);
    return query;
  });
  query.single.mockImplementation(async () => ({
    data:
      rows.find(row =>
        filters.every(([key, value]) => row[key as keyof typeof row] === value)
      ) ?? null,
    error: null,
  }));
});
afterEach(() => vi.restoreAllMocks());
describe("public PDP visibility with privileged read access", () => {
  it("hides inactive published products even when RLS allows an admin to read them", async () => {
    expect(await productService.getById("inactive")).toBeNull();
  });
  it("keeps public active/published products available and drafts hidden", async () => {
    expect(await productService.getById("active")).toMatchObject({
      id: "active",
    });
    filters.length = 0;
    expect(await productService.getById("draft")).toBeNull();
  });
  it("preserves explicit admin editor loading of drafts/inactive rows", async () => {
    expect(
      await productService.getById("draft", { includeUnpublished: true })
    ).toMatchObject({ id: "draft" });
    expect(filters).toEqual([["id", "draft"]]);
  });
  it("preserves the guest column privacy boundary", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await productService.getById("active");
    const columns = query.select.mock.calls[0][0].split(",");
    expect(columns).not.toContain("*");
    for (const column of ["price", "mrp", "bulk_price", "price_per_piece"])
      expect(columns).not.toContain(column);
  });
});
