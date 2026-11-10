import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { api, setUnauthorizedHandler, TOKEN_KEY } from "@/services/api";

export type Preferences = {
  aiPersonalization: boolean;
  aiUseMoodContext: boolean;
  dailyMoodReminder: boolean;
  dailyMoodTime: string;
  affirmationReminder: boolean;
  affirmationTime: string;
  breathingReminder: boolean;
  breathingTime: string;
  selfCareReminder: boolean;
  selfCareTime: string;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  preferences?: Preferences | null;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
};

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  async hydrate() {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) return set({ loading: false });
      const { data } = await api.get("/api/auth/me");
      set({ user: data.user, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  async refresh() {
    const { data } = await api.get("/api/auth/me");
    set({ user: data.user });
  },
  async login(email, password) {
    const { data } = await api.post("/api/auth/login", { email, password });
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    set({ user: data.user });
    await get().refresh().catch(() => {});
  },
  async register(email, password, displayName) {
    const { data } = await api.post("/api/auth/register", { email, password, displayName });
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    set({ user: data.user });
    await get().refresh().catch(() => {});
  },
  async logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ user: null });
  },
  setUser: (user) => set({ user }),
}));

setUnauthorizedHandler(() => useAuth.setState({ user: null }));
