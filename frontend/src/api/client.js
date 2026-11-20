import axios from "axios";
import { storage } from "../utils/storage.js";

const TOKEN_KEY = "dairy_token";

export const tokenStore = {
  get: () => storage.get(TOKEN_KEY),
  set: (token) => storage.set(TOKEN_KEY, token),
  clear: () => storage.remove(TOKEN_KEY),
};

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "" });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the server says our login is no longer valid, sign out everywhere.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginCall = err.config?.url?.includes("/auth/login");
    if (err.response?.status === 401 && !isLoginCall) {
      tokenStore.clear();
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(err);
  }
);

/** Turns any API/network error into one plain English sentence. useT().tError() translates it. */
export function errorMessage(err) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (err?.response) return "Something went wrong. Please try again.";
  return "Cannot reach the server. Please check the internet and try again.";
}

export default api;
