export type EscrowStatus = "pending" | "held" | "released" | "refunded" | "disputed";

/** What the tasker actually receives (amount minus the 10% company fee). */
export const payoutOf = (p: { amount: number; payout?: number }) => p.payout ?? Math.round(p.amount * 0.9 * 100) / 100;

export interface Payment {
  id: string;
  taskId: string;
  payerId: string;
  payeeId: string;
  payeeName?: string;
  amount: number;
  /** Questly fee and the tasker share; set once the payment is released. */
  commission?: number;
  payout?: number;
  status: EscrowStatus;
  createdAt: string;
  releasedAt?: string;
}
