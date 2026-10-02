import { create } from "zustand";
import { supabase, UserProfile } from "./supabase";
import { invalidateSessionCache } from "./productService";

// The database owns privileges. Email and user-editable Auth metadata never
// grant admin access, including when a profile cannot be loaded.
function resolveIsAdmin(profile: UserProfile | null): boolean {
  return profile?.is_admin === true;
}

async function fetchUserProfile(user: { id: string; email?: string | null }) {
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch user profile:", error.message);
  }

  return { profile, error };
}

async function buildAuthState(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const result = await fetchUserProfile(user);
  let profile = result.error ? null : result.profile;

  if (!result.error && !profile && user.email) {
    const { data: created, error } = await supabase
      .from("user_profiles")
      .insert({
        id: user.id,
        email: user.email,
        company_name: typeof user.user_metadata?.company_name === "string" ? user.user_metadata.company_name : undefined,
        is_active: true,
        is_admin: false,
      })
      .select("*")
      .maybeSingle();

    if (!error && created) {
      profile = created;
    }
  }

  return {
    user,
    profile: profile || null,
    isAuthenticated: true,
    isAdmin: resolveIsAdmin(profile),
  };
}

let authListenerAttached = false;
let authRevision = 0;

interface AuthState {
  user: any | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;

  initialize: () => Promise<void>;
  refreshProfile: () => Promise<boolean>;
  signUp: (
    email: string,
    password: string,
    company: string
  ) => Promise<{ error: any | null; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  signOut: () => Promise<void>;
  updateProfile: (
    updates: Partial<UserProfile>
  ) => Promise<{ error: any | null }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAdmin: false,
  isAuthenticated: false,

  initialize: async () => {
    try {
      if (!supabase.auth?.getSession) {
        console.warn("Supabase auth not available (demo mode)");
        set({ isLoading: false });
        return;
      }

      if (!authListenerAttached) {
        authListenerAttached = true;
        supabase.auth.onAuthStateChange((event, session) => {
          // productService caches the has-session flag that gates price
          // columns (guest vs auth). Invalidate on EVERY auth event so a
          // stale cache can never show prices to anon users after logout.
          invalidateSessionCache();

          if (event === "TOKEN_REFRESHED" && session?.user && get().user?.id === session.user.id) {
            // Silently update stored user so the refreshed JWT stays in sync.
            // No isLoading flip, no profile refetch — avoids a global re-render
            // on every tab focus / ~55-min token rotation.
            set({ user: session?.user ?? null });
            return;
          }

          if (event === "SIGNED_IN") {
            const currentUser = get().user;
            if (currentUser && session?.user && session.user.id === currentUser.id) {
              // supabase-js re-emits SIGNED_IN on every tab refocus when a
              // session already exists. Same user — skip isLoading to prevent
              // the full-screen spinner from appearing on every refocus.
              set({ user: session.user });
              return;
            }
            // Genuine new sign-in (no previous user, or different account).
            // Profile loading is scheduled below, outside Supabase's awaited
            // callback, so its authenticated REST request cannot hold Auth's lock.
          }

          if (event === "SIGNED_OUT") {
            ++authRevision;
            set({
              user: null,
              profile: null,
              isAuthenticated: false,
              isAdmin: false,
              isLoading: false,
            });
            return;
          }

          // INITIAL_SESSION and any future events: use session if present.
          if (session?.user) {
            set({ isLoading: true });
            const revision = ++authRevision;
            setTimeout(() => {
              if (revision !== authRevision) return;
              void buildAuthState(session.user).then(authState => {
                if (revision === authRevision) set({ ...authState, isLoading: false });
              }).catch(error => {
                console.error("Profile initialization error:", error);
                if (revision === authRevision) set({ profile: null, isAdmin: false, isLoading: false });
              });
            }, 0);
          } else {
            ++authRevision;
            set({
              user: null,
              profile: null,
              isAuthenticated: false,
              isAdmin: false,
              isLoading: false,
            });
          }
        });
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const revision = ++authRevision;
        const authState = await buildAuthState(session.user);
        if (revision === authRevision) set({ ...authState, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error("Auth initialization error:", error);
      set({ isLoading: false });
    }
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return false;

    set({ isLoading: true });
    const revision = ++authRevision;
    const authState = await buildAuthState(user);
    if (revision !== authRevision) return false;
    set({ ...authState, isLoading: false });
    return authState.isAdmin;
  },

  signUp: async (email: string, password: string, company: string) => {
    try {
      const {
        data: { session },
        error: signUpError,
      } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { company_name: company } },
      });

      if (signUpError) return { error: signUpError };

      if (session?.user) {
        const revision = ++authRevision;
        const authState = await buildAuthState(session.user);
        if (revision === authRevision) set({ ...authState, isLoading: false });
      } else {
        // An unconfirmed Auth user is not an authenticated session and cannot
        // create its profile through authenticated RLS yet.
        return { error: null, needsEmailConfirmation: true };
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      set({ isLoading: true });

      const {
        data: { user },
        error,
      } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        set({ isLoading: false });
        return { error };
      }

      if (user) {
        const revision = ++authRevision;
        const authState = await buildAuthState(user);
        if (revision === authRevision) set({ ...authState, isLoading: false });
      } else {
        set({ isLoading: false });
      }

      return { error: null };
    } catch (error) {
      set({ isLoading: false });
      return { error };
    }
  },

  signOut: async () => {
    ++authRevision;
    await supabase.auth.signOut();
    invalidateSessionCache();
    set({
      user: null,
      profile: null,
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
    });
  },

  updateProfile: async (updates: Partial<UserProfile>) => {
    try {
      const editable = new Set(["company_name", "contact_person", "phone", "address", "city", "state", "pincode", "gst_number"]);
      if (Object.keys(updates).some(key => !editable.has(key))) {
        return { error: new Error("Only contact and business profile details can be edited here") };
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { error: "Not authenticated" };

      const { error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) return { error };

      set(state => {
        const profile = state.profile ? { ...state.profile, ...updates } : null;
        return {
          profile,
          isAdmin: resolveIsAdmin(profile),
        };
      });

      return { error: null };
    } catch (error) {
      return { error };
    }
  },
}));
