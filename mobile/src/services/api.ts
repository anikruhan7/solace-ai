import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const BASE: string =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
  "http://10.0.2.2:4000";

export const TOKEN_KEY = "solace_token";

export const api = axios.create({ baseURL: BASE, timeout: 30000 });

let onUnauthorized: (() => void) | null = null;
/** The auth store registers this so a 401 also clears the signed-in user, not just the token. */
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401 && !String(err.config?.url ?? "").includes("/auth/login")) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      onUnauthorized?.();
    }
    return Promise.reject(err);
  }
);

/** Turn any request error into one friendly sentence. */
export function errorMessage(e: any, fallback = "Something went wrong. Please try again.") {
  if (e?.response?.data?.error) return String(e.response.data.error);
  if (e?.code === "ECONNABORTED" || e?.message === "Network Error") {
    return "Can't reach the server. Check your connection and try again.";
  }
  return fallback;
}

/** Minutes offset for the server so streaks follow the user's local day. */
export const tzParam = () => ({ tz: new Date().getTimezoneOffset() });

export const API_URL = BASE;
