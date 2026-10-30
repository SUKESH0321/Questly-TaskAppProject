import { create } from "zustand";
import api from "@/lib/api";
import type { Payment } from "@/types/payment";

interface PaymentState {
  payments: Record<string, Payment>; // keyed by taskId

  initiatePayment: (taskId: string, amount: number) => Promise<void>;
  releasePayment: (taskId: string) => Promise<void>;
  refundPayment: (taskId: string) => Promise<void>;
  disputePayment: (taskId: string) => void;
  fetchPayment: (taskId: string) => Promise<Payment | undefined>;
  fetchMyPayments: () => Promise<Payment[]>;
  getPayment: (taskId: string) => Payment | undefined;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  payments: {},

  initiatePayment: async (taskId, _amount) => {
    try {
      const res = await api.post("/payments/initiate", { taskId });
      const payment = res.data.payment;
      set((state) => ({
        payments: { ...state.payments, [taskId]: payment },
      }));
    } catch (err) {
      console.error("Payment initiation failed", err);
      throw err;
    }
  },

  releasePayment: async (taskId) => {
    try {
      const res = await api.post(`/payments/release/${taskId}`);
      const payment = res.data.payment;
      set((state) => ({
        payments: { ...state.payments, [taskId]: payment },
      }));
    } catch (err) {
      console.error("Payment release failed", err);
      throw err;
    }
  },

  fetchPayment: async (taskId) => {
    try {
      const res = await api.get(`/payments/${taskId}`);
      const payment = res.data.payment;
      if (payment) {
        set((state) => ({
          payments: { ...state.payments, [taskId]: payment },
        }));
      }
      return payment;
    } catch {
      // 404 means no payment exists yet — that's fine
      return undefined;
    }
  },

  fetchMyPayments: async () => {
    try {
      const res = await api.get("/payments/mine");
      const payments = Array.isArray(res.data?.payments) ? res.data.payments : [];
      const byTask: Record<string, Payment> = {};
      payments.forEach((p: Payment) => {
        byTask[p.taskId] = p;
      });
      set((state) => ({ payments: { ...state.payments, ...byTask } }));
      return payments;
    } catch (err) {
      console.error("Failed to fetch my payments", err);
      return [];
    }
  },

  refundPayment: async (_taskId) => {
    // Backend refund endpoint can be added later
    console.warn("Refund not implemented on backend yet");
  },

  disputePayment: (_taskId) => {
    // Backend dispute endpoint can be added later
    console.warn("Dispute not implemented on backend yet");
  },

  getPayment: (taskId) => get().payments[taskId],
}));