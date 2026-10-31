import { create } from "zustand";
import api from "@/lib/api";
import { getApiError } from "@/lib/errors";
import { useTaskStore } from "@/stores/taskStore";
import { usePaymentStore } from "@/stores/paymentStore";

export type UserRole = "customer" | "tasker" | "both" | "admin" | null;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  portfolioImages?: string[];
  phone?: string;
  location?: string;
  about?: string;
  skills?: string[];
  education?: string;
  certificates?: string;
  portfolioLink?: string;
  workingDays?: string[];
  startTime?: string;
  endTime?: string;
  travelRadius?: number;
  /** True once the mobile number was confirmed by SMS code. */
  phoneVerified?: boolean;
  /** Identity (Aadhaar) verification state. */
  kycStatus?: "none" | "pending" | "verified" | "rejected";
  kycAadhaarMasked?: string;
  kycRejectionReason?: string;
  /** Whether this user must be ID-verified to apply for tasks. */
  kycRequired?: boolean;
  /** "none" = not available, "sandbox" = simulated (development only). */
  kycMode?: "none" | "sandbox";
  rating: number;
}

/** Fields the API accepts on PATCH /auth/me. */
export type UserUpdate = Partial<
  Omit<User, "id" | "email" | "rating" | "phoneVerified" | "kycStatus" | "kycAadhaarMasked" | "kycRejectionReason" | "kycRequired" | "kycMode">
>;

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean; // initial session check
  isSubmitting: boolean; // login/register in flight
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone: string) => Promise<void>;
  setRole: (role: UserRole) => Promise<void>;
  logout: () => void;
  updateUser: (data: UserUpdate) => Promise<void>;
  fetchUser: () => Promise<void>;
}

function persistSession(token: string, userId: string) {
  localStorage.setItem("questly_token", token);
  localStorage.setItem("questly_user_id", userId);
}

function clearSession() {
  localStorage.removeItem("questly_token");
  localStorage.removeItem("questly_user_id");
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isSubmitting: false,
  error: null,

  login: async (email, password) => {
    set({ isSubmitting: true, error: null });
    try {
      const res = await api.post("/auth/login", { email, password });
      const { user, token } = res.data;
      persistSession(token, user.id);
      set({ user, isAuthenticated: true, isSubmitting: false });
    } catch (err: unknown) {
      const message = getApiError(err, "Login failed");
      set({ isSubmitting: false, error: message });
      throw new Error(message);
    }
  },

  register: async (name, email, password, phone) => {
    set({ isSubmitting: true, error: null });
    try {
      const res = await api.post("/auth/register", { name, email, password, phone });
      const { user, token } = res.data;
      persistSession(token, user.id);
      set({ user, isAuthenticated: true, isSubmitting: false });
    } catch (err: unknown) {
      const message = getApiError(err, "Registration failed");
      set({ isSubmitting: false, error: message });
      throw new Error(message);
    }
  },

  // Saves to the server and only then updates local state. Throws with the
  // server's message on failure so the UI can show it.
  updateUser: async (data) => {
    try {
      const res = await api.patch("/auth/me", data);
      set({ user: res.data.user });
    } catch (err: unknown) {
      throw new Error(getApiError(err, "Failed to update your profile."));
    }
  },

  setRole: async (role) => {
    await get().updateUser({ role });
  },

  logout: () => {
    clearSession();
    // Drop cached data so the next person to sign in never sees it.
    useTaskStore.setState({ tasks: [], myPostedTasks: [], myWorkedTasks: [], isLoading: false });
    usePaymentStore.setState({ payments: {} });
    set({ user: null, isAuthenticated: false, isLoading: false, error: null });
  },

  fetchUser: async () => {
    const token = localStorage.getItem("questly_token");
    if (!token) {
      set({ isAuthenticated: false, isLoading: false, user: null });
      return;
    }

    set({ isLoading: true });

    try {
      const res = await api.get("/auth/me");
      set({ user: res.data.user, isAuthenticated: true, isLoading: false, error: null });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 404) {
        // Token is invalid/expired or the account is gone.
        clearSession();
        set({ user: null, isAuthenticated: false, isLoading: false, error: null });
      } else {
        // Server unreachable: keep the token so a reload can recover; the app
        // shows the signed-out state instead of wiping the session.
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    }
  },
}));
