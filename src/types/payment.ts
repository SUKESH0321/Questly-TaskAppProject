export type EscrowStatus = "pending" | "held" | "released" | "refunded" | "disputed";

export interface Payment {
  id: string;
  taskId: string;
  payerId: string;
  payeeId: string;
  payeeName?: string;
  amount: number;
  status: EscrowStatus;
  createdAt: string;
  releasedAt?: string;
}
