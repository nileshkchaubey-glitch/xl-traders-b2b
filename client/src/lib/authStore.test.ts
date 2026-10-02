import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), getSession: vi.fn(), getUser: vi.fn(),
  onAuthStateChange: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), invalidate: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { from: mocks.from, auth: mocks } }));
vi.mock("./productService", () => ({ invalidateSessionCache: mocks.invalidate }));

let store: typeof import("./authStore").useAuthStore;
const user = { id: "customer", email: "nileshk.chaubey@gmail.com", user_metadata: { company_name: "Example", is_admin: true } };
const profile = { id: user.id, email: user.email, is_admin: false, is_active: true };
let query: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; maybeSingle: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
beforeEach(async () => {
  vi.resetModules(); vi.resetAllMocks();
  query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), insert: vi.fn(), update: vi.fn() };
  for (const key of ["select", "eq", "insert", "update"] as const) query[key].mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: profile, error: null });
  mocks.from.mockReturnValue(query);
  mocks.signInWithPassword.mockResolvedValue({ data: { user }, error: null });
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  store = (await import("./authStore")).useAuthStore;
});

describe("database-owned admin privileges", () => {
  it("never grants admin from allowlisted email or editable Auth metadata", async () => {
    await store.getState().signIn(user.email, "test-only");
    expect(store.getState().isAuthenticated).toBe(true);
    expect(store.getState().isAdmin).toBe(false);
  });
  it("recognizes an actual database admin independent of email", async () => {
    query.maybeSingle.mockResolvedValue({ data: { ...profile, is_admin: true }, error: null });
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { ...user, email: "different@example.invalid" } }, error: null });
    await store.getState().signIn("different@example.invalid", "test-only");
    expect(store.getState().isAdmin).toBe(true);
  });
  it("creates a missing profile with customer flags, never admin flags", async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: profile, error: null });
    await store.getState().signIn(user.email, "test-only");
    expect(query.insert).toHaveBeenCalledWith({ id: user.id, email: user.email, company_name: "Example", is_active: true, is_admin: false });
    expect(store.getState().isAdmin).toBe(false);
  });
  it("does not insert or grant admin after a profile read error", async () => {
    query.maybeSingle.mockResolvedValue({ data: { ...profile, is_admin: true }, error: { message: "Profile unavailable" } });
    await store.getState().signIn(user.email, "test-only");
    expect(query.insert).not.toHaveBeenCalled(); expect(store.getState().isAdmin).toBe(false);
  });
  it("fails safely when customer profile creation is rejected", async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: { message: "Rejected" } });
    await store.getState().signIn(user.email, "test-only");
    expect(store.getState().profile).toBeNull(); expect(store.getState().isAdmin).toBe(false);
  });
  it("does not fake authentication or write a profile before email confirmation", async () => {
    mocks.signUp.mockResolvedValue({ data: { user, session: null }, error: null });
    expect(await store.getState().signUp(user.email, "test-only", "Example")).toEqual({ error: null, needsEmailConfirmation: true });
    expect(store.getState().isAuthenticated).toBe(false); expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.signUp).toHaveBeenCalledWith({ email: user.email, password: "test-only", options: { data: { company_name: "Example" } } });
  });
  it("loads the database profile for signup with an actual session", async () => {
    mocks.signUp.mockResolvedValue({ data: { user, session: { user } }, error: null });
    await store.getState().signUp(user.email, "test-only", "Example");
    expect(store.getState().isAuthenticated).toBe(true); expect(store.getState().isAdmin).toBe(false);
  });
  it.each(["is_admin", "is_active", "email", "id"])("rejects self-service edits to %s before making a request", async key => {
    expect((await store.getState().updateProfile({ [key]: true })).error).toBeInstanceOf(Error);
    expect(mocks.getUser).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("keeps ordinary profile updates available without changing privilege flags", async () => {
    await store.getState().signIn(user.email, "test-only");
    mocks.getUser.mockResolvedValue({ data: { user } });
    query.eq.mockResolvedValue({ error: null });
    expect(await store.getState().updateProfile({ company_name: "Updated company" })).toEqual({ error: null });
    expect(query.update).toHaveBeenCalledWith({ company_name: "Updated company" });
    expect(store.getState().profile?.company_name).toBe("Updated company");
    expect(store.getState().isAdmin).toBe(false);
  });
  it("does not resurrect admin state when a pending profile load finishes after logout", async () => {
    let finish!: (value: unknown) => void;
    query.maybeSingle.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const signingIn = store.getState().signIn(user.email, "test-only");
    await vi.waitFor(() => expect(query.maybeSingle).toHaveBeenCalled());
    await store.getState().signOut();
    finish({ data: { ...profile, is_admin: true }, error: null }); await signingIn;
    expect(store.getState().isAuthenticated).toBe(false); expect(store.getState().isAdmin).toBe(false);
  });
  it("keeps authenticated REST work outside the awaited Auth callback", async () => {
    await store.getState().initialize();
    const callback = mocks.onAuthStateChange.mock.calls[0][0];
    vi.useFakeTimers();
    try {
      expect(callback("SIGNED_IN", { user })).toBeUndefined();
      expect(mocks.from).not.toHaveBeenCalled();
      callback("SIGNED_OUT", null);
      await vi.runAllTimersAsync();
      expect(mocks.from).not.toHaveBeenCalled(); expect(store.getState().isAdmin).toBe(false);
    } finally { vi.useRealTimers(); }
  });
});
