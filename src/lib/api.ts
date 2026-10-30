import axios from "axios";

const api = axios.create({
  // Set VITE_API_URL per environment (web, Android emulator, production).
  // Single-deploy production serves the site and the API from one address, so "/api" just works.
  // Local dev talks to :3001; the Capacitor app sets VITE_API_URL to an absolute address.
  baseURL: import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "/api" : "http://localhost:3001/api"),
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the JWT token from localStorage as Bearer token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("questly_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 on an authenticated call means the token expired or was revoked.
// Tell the app (decoupled via an event) so it can sign the user out.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? "";
    const isCredentialCall = url.startsWith("/auth/login") || url.startsWith("/auth/register");
    if (status === 401 && !isCredentialCall && localStorage.getItem("questly_token")) {
      window.dispatchEvent(new Event("questly:unauthorized"));
    }
    return Promise.reject(error);
  },
);

export default api;
