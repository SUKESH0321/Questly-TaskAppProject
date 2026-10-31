import mongoose, { Schema, Document } from "mongoose";

export type EscrowStatus = "pending" | "held" | "released" | "refunded" | "disputed";

export interface IPayment extends Document {
  taskId: mongoose.Types.ObjectId;
  payerId: mongoose.Types.ObjectId;
  payeeId: mongoose.Types.ObjectId;
  payeeName?: string;
  amount: number;
  /** Questly's 10% fee and what the tasker receives; set when the payment is released. */
  commission?: number;
  payout?: number;
  status: EscrowStatus;
  createdAt: Date;
  releasedAt?: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    payerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    payeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    payeeName: { type: String, default: "" },
    amount: { type: Number, required: true },
    commission: { type: Number },
    payout: { type: Number },
    status: {
      type: String,
      enum: ["pending", "held", "released", "refunded", "disputed"],
      default: "pending",
    },
    releasedAt: { type: Date },
  },
  { timestamps: true }
);

// Exactly one escrow payment per task.
PaymentSchema.index({ taskId: 1 }, { unique: true });

export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);