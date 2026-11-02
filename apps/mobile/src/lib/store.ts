import { create } from 'zustand';
import { supabase } from './supabase';

export interface User {
  id: string;
  email: string;
  phone?: string | null;
  full_name?: string;
  avatar_url?: string;
  role: 'user' | 'coach' | 'gym_owner' | 'admin';
  fitness_goal?: string;
  preferred_sports?: string[];
  onboarding_completed: boolean;
}

interface AppState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (val: boolean) => void;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string, email?: string) => Promise<void>;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (val) => set({ isLoading: val }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
  fetchProfile: async (userId: string, email?: string) => {
    const fallbackUser: User = {
      id: userId,
      email: email ?? '',
      role: 'user',
      onboarding_completed: false,
    };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        set({
          user: {
            ...fallbackUser,
            ...data,
            role: data.role ?? 'user',
            onboarding_completed: Boolean(data.onboarding_completed),
          } as User,
        });
      } else {
        set({ user: fallbackUser });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      set({ user: fallbackUser });
    }
  },
}));
