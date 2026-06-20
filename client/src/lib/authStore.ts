import { create } from "zustand";
import { supabase, UserProfile } from "./supabase";
import { invalidateSessionCache } from "./productService";

const ADMIN_EMAILS = new Set(
  (import.meta.env.VITE_ADMIN_EMAILS || "nileshk.chaubey@gmail.com")
    .split(",")
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean)
);

function resolveIsAdmin(
  user: { email?: string | null } | null,
  profile: UserProfile | null
): boolean {
  if (profile?.is_admin === true) return true;
  const email = user?.email?.toLowerCase();
  return !!email && ADMIN_EMAILS.has(email);
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

  return profile;
}

async function buildAuthState(user: { id: string; email?: string | null }) {
  let profile = await fetchUserProfile(user);

  if (!profile && user.email) {
    const isKnownAdmin = ADMIN_EMAILS.has(user.email.toLowerCase());
    const { data: created, error } = await supabase
      .from("user_profiles")
      .insert({
        id: user.id,
        email: user.email,
        is_active: true,
        is_admin: isKnownAdmin,
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
    isAdmin: resolveIsAdmin(user, profile),
  };
}

let authListenerAttached = false;

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
  ) => Promise<{ error: any | null }>;
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
        supabase.auth.onAuthStateChange(async (event, session) => {
          // productService caches the has-session flag that gates price
          // columns (guest vs auth). Invalidate on EVERY auth event so a
          // stale cache can never show prices to anon users after logout.
          invalidateSessionCache();

          if (event === "TOKEN_REFRESHED") {
            // Silently update stored user so the refreshed JWT stays in sync.
            // No isLoading flip, no profile refetch — avoids a global re-render
            // on every tab focus / ~55-min token rotation.
            set({ user: session?.user ?? null });
            return;
          }

          if (event === "SIGNED_IN") {
            const currentUser = get().user;
            if (currentUser && session?.user?.id === currentUser.id) {
              // supabase-js re-emits SIGNED_IN on every tab refocus when a
              // session already exists. Same user — skip isLoading to prevent
              // the full-screen spinner from appearing on every refocus.
              set({ user: session.user });
              return;
            }
            // Genuine new sign-in (no previous user, or different account).
            set({ isLoading: true });
            const authState = await buildAuthState(session!.user);
            set({ ...authState, isLoading: false });
            return;
          }

          if (event === "SIGNED_OUT") {
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
            const authState = await buildAuthState(session.user);
            set({ ...authState, isLoading: false });
          } else {
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
        const authState = await buildAuthState(session.user);
        set({ ...authState, isLoading: false });
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
    const authState = await buildAuthState(user);
    set({ ...authState, isLoading: false });
    return authState.isAdmin;
  },

  signUp: async (email: string, password: string, company: string) => {
    try {
      const {
        data: { user },
        error: signUpError,
      } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) return { error: signUpError };

      if (user) {
        const { error: profileError } = await supabase
          .from("user_profiles")
          .insert({
            id: user.id,
            email,
            company_name: company,
            is_active: true,
          });

        if (profileError) return { error: profileError };

        set({
          user,
          isAuthenticated: true,
          isAdmin: resolveIsAdmin(user, null),
          profile: {
            id: user.id,
            email,
            company_name: company,
            is_admin: resolveIsAdmin(user, null),
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
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
        const authState = await buildAuthState(user);
        set({ ...authState, isLoading: false });
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
    await supabase.auth.signOut();
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
          isAdmin: resolveIsAdmin(state.user, profile),
        };
      });

      return { error: null };
    } catch (error) {
      return { error };
    }
  },
}));
