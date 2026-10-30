import mongoose, { Schema, Document } from "mongoose";

export interface IPhoneOtp extends Document {
  userId: mongoose.Types.ObjectId;
  phone: string;
  /** HMAC of the code; the code itself is never stored. */
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

const PhoneOtpSchema = new Schema<IPhoneOtp>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    phone: { type: String, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

PhoneOtpSchema.index({ userId: 1, createdAt: -1 });
// Keep records for 2 hours (needed for the "sends per hour" limit), then delete.
PhoneOtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7200 });

export const PhoneOtp = mongoose.model<IPhoneOtp>("PhoneOtp", PhoneOtpSchema);
