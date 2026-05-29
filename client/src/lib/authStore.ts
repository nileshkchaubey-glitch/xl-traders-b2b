import { create } from 'zustand';
import { supabase, UserProfile } from './supabase';

interface AuthState {
  user: any | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, company: string) => Promise<{ error: any | null }>;
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any | null }>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAdmin: false,
  isAuthenticated: false,

  initialize: async () => {
    try {
      // Check if Supabase is available
      if (!supabase.auth || !supabase.auth.getUser) {
        console.warn('Supabase auth not available (demo mode)');
        set({ isLoading: false });
        return;
      }
      
      // Check if user is already logged in
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Fetch user profile
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        set({
          user,
          profile: profile || null,
          isAuthenticated: true,
          isAdmin: profile?.is_admin || false,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isLoading: false });
    }
  },

  signUp: async (email: string, password: string, company: string) => {
    try {
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) return { error: signUpError };

      if (user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('user_profiles')
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
          profile: {
            id: user.id,
            email,
            company_name: company,
            is_admin: false,
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
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error };

      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        set({
          user,
          profile: profile || null,
          isAuthenticated: true,
          isAdmin: profile?.is_admin || false,
        });
      }

      return { error: null };
    } catch (error) {
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
    });
  },

  updateProfile: async (updates: Partial<UserProfile>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: 'Not authenticated' };

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) return { error };

      set((state) => ({
        profile: state.profile ? { ...state.profile, ...updates } : null,
      }));

      return { error: null };
    } catch (error) {
      return { error };
    }
  },
}));
